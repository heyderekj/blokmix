<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mix;
use App\Models\MixAsset;
use App\Services\SvgCleaner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * A mix's uploads. Members read them (the board downloads what its browser
 * doesn't have yet); owners and editors add them.
 */
class AssetController extends Controller
{
    public function index(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);

        return response()->json($mix->assets()->get()->map->toBoard());
    }

    public function store(Request $request, Mix $mix): JsonResponse
    {
        $role = $mix->roleOf($request->user());
        abort_unless($role, 404);
        abort_unless($role->canEdit(), 403, 'Viewers can’t add images.');
        abort_if($mix->isArchived(), 403, 'This mix is archived. Bring it back to add images.');
        // A server's own disk is wiped on every deploy: in production, keep uploads in the browser until a bucket is attached.
        $driver = config('filesystems.disks.'.config('blokmix.uploads_disk').'.driver');
        abort_if(app()->isProduction() && $driver === 'local', 503, 'Uploads aren’t set up on this server yet. They stay in your browser for now.');

        $input = $request->validate([
            'id' => ['required', 'string', 'regex:/^(img|vid|lot)_[a-z0-9]{8}$/'],
            'kind' => ['required', Rule::in(['image', 'video', 'lottie'])],
            'name' => ['required', 'string', 'max:255'],
            'mime' => ['required', 'string', 'max:100'],
            'width' => ['nullable', 'integer', 'min:0'],
            'height' => ['nullable', 'integer', 'min:0'],
            'file' => ['required', 'file', 'max:'.config('blokmix.upload_max_kb')],
            'poster' => ['nullable', 'file', 'max:4096'],
        ]);
        // The type it's served with is the one it was sent with, so only what each kind can be.
        $allowed = [
            'image' => '#^image/(webp|png|jpeg|gif|avif|svg\+xml)$#',
            'video' => '#^video/[a-z0-9.+-]+$#',
            'lottie' => '#^application/(json|zip|octet-stream)$#',
        ];
        abort_unless(preg_match($allowed[$input['kind']], $input['mime']), 422, 'That kind of file can’t be added.');
        // An SVG is a document that could carry script: it's cleaned before it's kept.
        if ($input['mime'] === 'image/svg+xml') {
            $clean = SvgCleaner::clean((string) file_get_contents($request->file('file')->getRealPath()));
            abort_if($clean === null, 422, 'That SVG can’t be read.');
            file_put_contents($request->file('file')->getRealPath(), $clean);
            clearstatcache(true, $request->file('file')->getRealPath());
        }
        // A cleaned SVG is measured as kept; anything else as it came.
        $size = $input['mime'] === 'image/svg+xml' ? (int) filesize($request->file('file')->getRealPath()) : $request->file('file')->getSize();

        // Uploads count toward the mix owner's plan, whoever adds them; replacing one only counts the difference.
        $owner = $mix->owner() ?? $request->user();
        $was = (int) $mix->assets()->where('key', $input['id'])->value('size');
        $why = $owner->uploadRefusal($size - $was);
        if ($why !== null && $owner->isNot($request->user())) {
            $why = 'This mix’s owner is out of room for images and video. It stays in this browser.';
        }
        abort_if($why !== null, 403, (string) $why);

        $disk = Storage::disk(config('blokmix.uploads_disk'));
        $dir = "mixes/{$mix->id}";
        $path = $disk->putFileAs($dir, $request->file('file'), $input['id']);
        $poster = $request->hasFile('poster') ? $disk->putFileAs($dir, $request->file('poster'), $input['id'].'-poster') : null;

        $asset = $mix->assets()->updateOrCreate(['key' => $input['id']], [
            'kind' => $input['kind'],
            'name' => $input['name'],
            'mime' => $input['mime'],
            'width' => $input['width'] ?? 0,
            'height' => $input['height'] ?? 0,
            'size' => $size,
            'path' => $path,
            'poster_path' => $poster,
        ]);

        return response()->json($asset->toBoard(), 201);
    }

    public function show(Request $request, Mix $mix, string $key): StreamedResponse
    {
        return $this->stream($request, $mix, $key, false);
    }

    public function poster(Request $request, Mix $mix, string $key): StreamedResponse
    {
        return $this->stream($request, $mix, $key, true);
    }

    private function stream(Request $request, Mix $mix, string $key, bool $poster): StreamedResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);
        $asset = $mix->assets()->where('key', $key)->firstOrFail();
        $path = $poster ? $asset->poster_path : $asset->path;
        abort_unless($path, 404);

        return Storage::disk(config('blokmix.uploads_disk'))->response($path, null, [
            'Content-Type' => $poster ? 'image/webp' : $asset->mime,
            'Cache-Control' => 'private, max-age=31536000, immutable',
            // Opened on its own (an SVG especially), an upload can't run anything or load anything else.
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
