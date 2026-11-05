<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\PublishedController;
use App\Models\Mix;
use App\Models\Publication;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use GuzzleHttp\Promise\Each;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * A mix on blok.page. The board builds the pages (the same code as exports) and sends them as one zip; this keeps
 * them under published/<code>/ and PublishedController serves them on the publish host. Members read; owners and
 * editors publish and unpublish. Files count toward the mix owner's room, like its uploads.
 */
class PublicationController extends Controller
{
    /** One page or media file, and the whole bundle. */
    private const FILE_MAX_BYTES = 60 * 1024 * 1024;

    private const BUNDLE_MAX_BYTES = 300 * 1024 * 1024;

    /** core/export/publish.ts PUBLISH_BASE. */
    private const BASE = '/__blokmix_base__';

    public function show(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);
        $publication = Publication::where('mix_id', $mix->id)->first();

        return response()->json(['publication' => $publication?->toBoard()]);
    }

    public function update(Request $request, Mix $mix): JsonResponse
    {
        $this->authorizeEdit($request, $mix);
        $driver = config('filesystems.disks.'.config('blokmix.uploads_disk').'.driver');
        abort_if(app()->isProduction() && $driver === 'local', 503, 'Publishing isn’t set up on this server yet.');

        $input = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'version' => ['nullable', 'string', 'max:64'],
            'bundle' => ['required', 'file', 'max:'.intdiv(self::BUNDLE_MAX_BYTES, 1024)],
        ]);
        $files = $this->unzip($request->file('bundle'));
        $pages = array_values(array_map(
            fn ($p) => $p === 'index.html' ? '/' : '/'.substr($p, 0, -5),
            array_filter(array_keys($files), fn ($p) => str_ends_with($p, '.html')),
        ));
        if (! isset($files['index.html'])) {
            throw ValidationException::withMessages(['bundle' => 'The bundle has no index.html.']);
        }

        $owner = $mix->owner() ?? $request->user();
        $badge = $owner->planName() === 'free';
        $publication = Publication::firstOrNew(['mix_id' => $mix->id], ['code' => Publication::freshCode(), 'kind' => 'mix']);
        $slug = Publication::slugFor($input['name']);
        foreach ($files as $path => $data) {
            if (str_ends_with($path, '.html')) {
                // The board writes links and pictures under a stand-in base (core/export/publish.ts PUBLISH_BASE).
                $data = str_replace(self::BASE, "/{$publication->code}/{$slug}", $data);
                $files[$path] = $badge ? self::withBadge($data) : $data;
            }
        }
        $size = array_sum(array_map('strlen', $files));
        $why = $owner->publishRefusal($mix, $size);
        if ($why !== null && $owner->isNot($request->user())) {
            $why = 'This mix’s owner can’t publish it: '.lcfirst($why);
        }
        abort_if($why !== null, 403, (string) $why);

        $disk = Storage::disk(config('blokmix.uploads_disk'));
        // Republishing replaces everything, so a page or picture that's gone doesn't linger at its old address.
        if ($publication->exists) {
            $disk->deleteDirectory($publication->dir());
        }
        $publication->fill([
            'user_id' => $owner->id,
            'version_key' => $input['version'] ?? null,
            'name' => $input['name'],
            'slug' => $slug,
            'pages' => $pages,
            'size' => $size,
            'badge' => $badge,
            'published_at' => now(),
            'unpublished_at' => null,
        ]);
        self::putAll($disk, $publication->dir(), $files);
        $publication->save();

        return response()->json(['publication' => $publication->toBoard()]);
    }

    public function destroy(Request $request, Mix $mix): JsonResponse
    {
        $this->authorizeEdit($request, $mix);
        $publication = Publication::where('mix_id', $mix->id)->first();
        if ($publication?->isLive()) {
            Storage::disk(config('blokmix.uploads_disk'))->deleteDirectory($publication->dir());
            $publication->update(['unpublished_at' => now(), 'size' => 0]);
        }

        return response()->json(['publication' => $publication?->toBoard()]);
    }

    /** How many files go up to the bucket at once. */
    private const PARALLEL_PUTS = 24;

    /**
     * Write a publication's files under $dir. On a bucket (S3, R2) they go up many at a time, since one at a time a
     * mix with dozens of pictures waits on dozens of round trips; any other disk writes them in turn.
     *
     * @param  array<string, string>  $files
     */
    public static function putAll(Filesystem $disk, string $dir, array $files): void
    {
        if (! $disk instanceof AwsS3V3Adapter) {
            foreach ($files as $path => $data) {
                $disk->put("{$dir}/{$path}", $data);
            }

            return;
        }
        $client = $disk->getClient();
        $bucket = $disk->getConfig()['bucket'];
        $puts = (function () use ($client, $bucket, $disk, $dir, $files) {
            foreach ($files as $path => $data) {
                yield $client->putObjectAsync([
                    'Bucket' => $bucket,
                    'Key' => $disk->path("{$dir}/{$path}"),
                    'Body' => $data,
                    'ContentType' => PublishedController::typeOf($path),
                ]);
            }
        })();
        // Any failed put rejects the whole write, so a half-published mix never reports success.
        Each::ofLimitAll($puts, self::PARALLEL_PUTS)->wait();
    }

    /** "Made with Blokmix", on Free: a small link in the corner, before </body>. */
    public static function withBadge(string $html): string
    {
        $badge = '<a href="https://blokmix.com" target="_blank" rel="noopener" data-blokmix-badge style="position:fixed;right:12px;bottom:12px;z-index:2147483647;'
            .'display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#111;color:#fff;'
            .'font:500 12px/1.2 system-ui,-apple-system,sans-serif;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.2)">Made with Blokmix</a>';
        $at = strripos($html, '</body>');

        return $at === false ? $html.$badge : substr($html, 0, $at).$badge.substr($html, $at);
    }

    private function authorizeEdit(Request $request, Mix $mix): void
    {
        $role = $mix->roleOf($request->user());
        abort_unless($role, 404);
        abort_unless($role->canEdit(), 403, 'Viewers can’t publish.');
        abort_if($mix->isArchived(), 403, 'This mix is archived. Bring it back to publish it.');
    }

    /**
     * The bundle's files by path: pages (`about.html`, `work/one.html`) and `media/…`. Anything else, any path that
     * climbs out (`..`) and anything too big is refused before it's unpacked.
     *
     * @return array<string, string>
     */
    private function unzip(UploadedFile $zip): array
    {
        $archive = new \ZipArchive;
        if ($archive->open($zip->getRealPath()) !== true) {
            throw ValidationException::withMessages(['bundle' => 'The bundle isn’t a zip.']);
        }
        if ($archive->numFiles > 2000) {
            throw ValidationException::withMessages(['bundle' => 'The bundle has more than 2,000 files.']);
        }
        $total = 0;
        $out = [];
        for ($i = 0; $i < $archive->numFiles; $i++) {
            $stat = $archive->statIndex($i);
            $name = $stat['name'];
            if (str_ends_with($name, '/')) {
                continue;
            }
            if (! self::safePath($name)) {
                throw ValidationException::withMessages(['bundle' => "{$name} isn’t a page or media file."]);
            }
            if ($stat['size'] > self::FILE_MAX_BYTES) {
                throw ValidationException::withMessages(['bundle' => "{$name} is over 60 MB."]);
            }
            if (($total += $stat['size']) > self::BUNDLE_MAX_BYTES) {
                throw ValidationException::withMessages(['bundle' => 'The pages and media are over 300 MB.']);
            }
            $out[$name] = (string) $archive->getFromIndex($i);
        }
        $archive->close();

        return $out;
    }

    /** A page (`index.html`, `about.html`, `work/one.html`) or a media file under `media/`; never `..` or a dotfile. */
    public static function safePath(string $path): bool
    {
        if (str_contains($path, '..') || str_contains($path, '//') || str_starts_with($path, '/')) {
            return false;
        }
        if (preg_match('#(^|/)\.#', $path)) {
            return false;
        }

        return (bool) (preg_match('#^[a-z0-9][a-z0-9_/-]*\.html$#i', $path)
            || preg_match('#^media/[A-Za-z0-9._/-]+\.(svg|png|jpe?g|webp|gif|avif|mp4|webm|mov|json|lottie)$#i', $path));
    }
}
