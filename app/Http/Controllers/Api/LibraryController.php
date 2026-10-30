<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LibraryAsset;
use App\Models\LibrarySection;
use App\Models\LibrarySite;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The site library: real websites captured by the library CLI. Anyone signed in browses published sites and reads
 * their screenshots; the people who run Blokmix (Gate run-blokmix) upload bundles, curate and take sites down.
 */
class LibraryController extends Controller
{
    /** The largest screenshot, and the largest bundle (all its screenshots together). */
    public const IMAGE_MAX_KB = 15 * 1024;

    public const BUNDLE_MAX_BYTES = 200 * 1024 * 1024;

    private const MIMES = ['image/webp' => 'webp', 'image/png' => 'png', 'image/jpeg' => 'jpg'];

    /** Published sites as cards (owners add `?drafts=1` to see drafts too). */
    public function index(Request $request): JsonResponse
    {
        $drafts = $request->boolean('drafts') && $this->isOwner();
        $sites = LibrarySite::query()->forCards()
            ->when(! $drafts, fn ($q) => $q->where('status', 'published'))
            ->orderBy('name')->get();

        return response()->json($sites->map->summary()->values());
    }

    public function show(string $slug): JsonResponse
    {
        $site = $this->visible($slug);

        return response()->json($site->full($this->isOwner()));
    }

    public function asset(string $id): StreamedResponse
    {
        $asset = LibraryAsset::with('site')->findOrFail($id);
        $published = $asset->site->isPublished();
        abort_unless($published || $this->isOwner(), 404);

        return Storage::disk(config('blokmix.uploads_disk'))->response($asset->path, null, [
            'Content-Type' => $asset->mime,
            'Cache-Control' => ($published ? 'public' : 'private').', max-age=31536000, immutable',
        ]);
    }

    /**
     * A bundle from the library CLI: `site` (site.json) and the screenshots it names, as `files[]` or as one zip,
     * `bundle` (PHP takes 20 files per request, fewer than a long page has sections). Upserts by slug: a
     * site already here keeps its status and gets the bundle's pages, sections and screenshots in place of its own.
     */
    public function store(Request $request): JsonResponse
    {
        $this->owner();
        $request->validate([
            'site' => ['required', 'file', 'max:2048'],
            'files' => ['required_without:bundle', 'array', 'max:2000'],
            'files.*' => ['required', 'file', 'mimetypes:'.implode(',', array_keys(self::MIMES)), 'max:'.self::IMAGE_MAX_KB],
            'bundle' => ['required_without:files', 'file', 'mimes:zip', 'max:'.(self::BUNDLE_MAX_BYTES / 1024)],
        ]);

        $json = json_decode((string) file_get_contents($request->file('site')->getRealPath()), true);
        if (! is_array($json)) {
            throw ValidationException::withMessages(['site' => 'site.json isn’t valid JSON.']);
        }
        $data = $this->validateSite($json);

        /** @var array<string, UploadedFile> $files by name */
        $files = [];
        foreach ($request->hasFile('bundle') ? $this->unzip($request->file('bundle')) : $request->file('files') as $file) {
            $files[$file->getClientOriginalName()] = $file;
        }
        $total = array_sum(array_map(fn (UploadedFile $f) => $f->getSize(), $files));
        if ($total > self::BUNDLE_MAX_BYTES) {
            throw ValidationException::withMessages(['files' => 'The bundle is over 200 MB.']);
        }

        // Which file is which: the thumbnail, each page's full screenshot, each section's crop.
        $kinds = [];
        if (! empty($data['thumb'])) {
            $kinds[basename($data['thumb'])] = 'thumb';
        }
        foreach ($data['pages'] as $page) {
            $kinds[basename($page['screenshot'])] ??= 'full';
            foreach ($page['sections'] ?? [] as $section) {
                if (! empty($section['screenshot'])) {
                    $kinds[basename($section['screenshot'])] ??= 'section';
                }
            }
        }
        $missing = array_keys(array_diff_key($kinds, $files));
        $extra = array_keys(array_diff_key($files, $kinds));
        if ($missing || $extra) {
            throw ValidationException::withMessages(array_filter([
                'files' => $missing ? 'site.json names files the bundle doesn’t have: '.implode(', ', $missing) : null,
                'extra' => $extra ? 'The bundle has files site.json doesn’t name: '.implode(', ', $extra) : null,
            ]));
        }

        // What each file really is, from its bytes (not its name or what the browser said).
        $images = [];
        foreach ($kinds as $name => $kind) {
            $info = @getimagesize($files[$name]->getRealPath());
            if (! $info || ! isset(self::MIMES[$info['mime']])) {
                throw ValidationException::withMessages(['files' => "{$name} isn’t a WebP, PNG or JPEG image."]);
            }
            $images[$name] = ['mime' => $info['mime'], 'width' => $info[0], 'height' => $info[1]];
        }

        $slug = $data['slug'] ?? Str::slug(preg_replace('/^www\./', '', (string) parse_url($data['url'], PHP_URL_HOST)));
        $site = LibrarySite::firstWhere('slug', $slug);
        $old = $site ? $site->assets()->pluck('path')->all() : [];

        // Files first (new ids, so nothing here yet is overwritten), then the rows in one go.
        $disk = Storage::disk(config('blokmix.uploads_disk'));
        $stored = [];
        try {
            foreach ($kinds as $name => $kind) {
                $id = LibraryAsset::newId();
                $stored[$name] = [
                    'id' => $id, 'kind' => $kind, 'name' => $name, 'size' => $files[$name]->getSize(), ...$images[$name],
                    'path' => $disk->putFileAs("library/{$slug}", $files[$name], $id.'.'.self::MIMES[$images[$name]['mime']]),
                ];
            }

            $site = DB::transaction(function () use ($site, $slug, $data, $stored) {
                $site ??= new LibrarySite(['slug' => $slug]);
                $site->fill(['name' => $data['name'], 'url' => $data['url']]);
                // What the bundle leaves out stays as curated.
                foreach (['industry', 'personality'] as $key) {
                    if (array_key_exists($key, $data)) {
                        $site->{$key} = $data[$key];
                    }
                }
                if (array_key_exists('effects', $data)) {
                    // Keyed by effect, each with its id (as the board keeps them) and its dials.
                    $site->effects = $data['effects'] ? collect($data['effects'])->map(fn ($v, $id) => ['id' => $id] + array_intersect_key($v, ['params' => 1]))->all() : null;
                }
                foreach (['tags', 'tokens', 'fonts'] as $key) {
                    if (array_key_exists($key, $data)) {
                        $site->{$key} = $data[$key] ?? [];
                    }
                }
                $site->updated_at = now();
                $site->save();
                $site->assets()->delete();
                $site->pages()->delete();

                foreach ($stored as $asset) {
                    $site->assets()->create($asset);
                }
                $id = fn (?string $name) => $name ? $stored[basename($name)]['id'] : null;
                foreach (array_values($data['pages']) as $i => $page) {
                    $row = $site->pages()->create([
                        'path' => $page['path'],
                        'title' => $page['title'] ?? null,
                        'order' => $page['order'] ?? $i,
                        'screenshot' => $id($page['screenshot']),
                        'width' => $page['width'] ?? $stored[basename($page['screenshot'])]['width'],
                        'height' => $page['height'] ?? $stored[basename($page['screenshot'])]['height'],
                    ]);
                    foreach (array_values($page['sections'] ?? []) as $j => $section) {
                        $layout = $section['layoutId'] ?? null;
                        $row->sections()->create([
                            'order' => $section['order'] ?? $j,
                            'type' => $section['type'],
                            'box' => ['y' => $section['box']['y'], 'h' => $section['box']['h']],
                            'layout_id' => $layout,
                            'score' => $section['score'] ?? null,
                            'status' => $section['status'] ?? ($layout ? 'matched' : 'needs_layout'),
                            'screenshot' => $id($section['screenshot'] ?? null),
                            'hint' => $section['hint'] ?? null,
                        ]);
                    }
                }

                return $site;
            });
        } catch (\Throwable $e) {
            $disk->delete(array_column($stored, 'path'));
            throw $e;
        }
        $disk->delete($old);

        return response()->json($site->fresh()->full(true), $site->wasRecentlyCreated ? 201 : 200);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $this->owner();
        $site = LibrarySite::where('slug', $slug)->firstOrFail();
        $input = $request->validate([
            'name' => ['sometimes', 'string', 'min:1', 'max:255'],
            'industry' => ['sometimes', 'nullable', 'string', 'max:80'],
            'tags' => ['sometimes', 'array', 'max:30'],
            'tags.*' => ['string', 'min:1', 'max:40'],
            'personality' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(LibrarySite::STATUSES)],
        ]);
        $site->update($input);

        return response()->json($site->full(true));
    }

    public function updateSection(Request $request, LibrarySection $section): JsonResponse
    {
        $this->owner();
        $input = $request->validate([
            'layout_id' => ['sometimes', 'nullable', 'string', 'regex:'.LibrarySection::LAYOUT_PATTERN],
            'status' => ['sometimes', Rule::in(LibrarySection::STATUSES)],
            'type' => ['sometimes', Rule::in(LibrarySection::TYPES)],
        ]);
        // Giving a section a layout matches it, and taking it away leaves it needing one (unless it's hidden).
        if (array_key_exists('layout_id', $input) && ! isset($input['status']) && $section->status !== 'hidden') {
            $input['status'] = $input['layout_id'] ? 'matched' : 'needs_layout';
        }
        $section->update($input);

        return response()->json($section->toApi());
    }

    /** Take a site down: its rows and every screenshot. */
    public function destroy(string $slug): JsonResponse
    {
        $this->owner();
        $site = LibrarySite::where('slug', $slug)->firstOrFail();
        $disk = Storage::disk(config('blokmix.uploads_disk'));
        $disk->delete($site->assets()->pluck('path')->all());
        $disk->deleteDirectory($site->dir());
        $site->delete();

        return response()->json(null, 204);
    }

    /** site.json, checked: only the shapes below get in. */
    /**
     * The images in a bundle zip, as uploads named by their file names. Only flat image names are taken; sizes are
     * checked before anything is unpacked, so a small zip can't unpack into something huge.
     *
     * @return list<UploadedFile>
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
        $dir = sys_get_temp_dir().'/blokmix-library-'.Str::random(12);
        mkdir($dir);
        register_shutdown_function(function () use ($dir) {
            array_map('unlink', glob("{$dir}/*") ?: []);
            @rmdir($dir);
        });
        $total = 0;
        $out = [];
        for ($i = 0; $i < $archive->numFiles; $i++) {
            $stat = $archive->statIndex($i);
            $name = $stat['name'];
            if (str_ends_with($name, '/') || str_starts_with(basename($name), '.')) {
                continue;
            }
            if ($name !== basename($name) || ! preg_match('/^[A-Za-z0-9._-]+\.(webp|png|jpe?g)$/i', $name)) {
                throw ValidationException::withMessages(['bundle' => "{$name} isn’t a screenshot name the bundle can hold."]);
            }
            if ($stat['size'] > self::IMAGE_MAX_KB * 1024) {
                throw ValidationException::withMessages(['bundle' => "{$name} is over 15 MB."]);
            }
            if (($total += $stat['size']) > self::BUNDLE_MAX_BYTES) {
                throw ValidationException::withMessages(['files' => 'The bundle is over 200 MB.']);
            }
            file_put_contents("{$dir}/{$name}", $archive->getFromIndex($i));
            $out[] = new UploadedFile("{$dir}/{$name}", $name, null, null, true);
        }
        $archive->close();

        return $out;
    }

    private function validateSite(array $json): array
    {
        $validator = Validator::make($json, [
            'slug' => ['sometimes', 'string', 'regex:/^[a-z0-9][a-z0-9-]{0,79}$/'],
            'name' => ['required', 'string', 'max:255'],
            'url' => ['required', 'string', 'max:2048', 'url:http,https'],
            'industry' => ['sometimes', 'nullable', 'string', 'max:80'],
            'tags' => ['sometimes', 'nullable', 'array', 'max:30'],
            'tags.*' => ['string', 'max:40'],
            'tokens' => ['sometimes', 'nullable', 'array', 'max:200'],
            'tokens.*' => ['nullable', fn ($key, $value, $fail) => is_scalar($value) || $fail('Tokens are words and numbers.')],
            'fonts' => ['sometimes', 'nullable', 'array', 'max:50'],
            // Detected effects, as treatment values; the board checks each dial against its spec.
            'effects' => ['sometimes', 'nullable', 'array:'.implode(',', LibrarySite::EFFECTS)],
            'effects.*' => ['array:id,params'],
            'effects.*.params' => ['sometimes', 'array', 'max:20'],
            'effects.*.params.*' => ['nullable', fn ($key, $value, $fail) => is_scalar($value) || (is_array($value) && count($value) <= 5 && array_is_list($value) && collect($value)->every(fn ($v) => is_string($v))) || $fail('Dials are numbers, words, switches or lists of colors.')],
            'personality' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'thumb' => ['sometimes', 'nullable', 'string', 'max:255'],
            'pages' => ['required', 'array', 'min:1', 'max:50'],
            'pages.*.path' => ['required', 'string', 'max:2048'],
            'pages.*.title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'pages.*.order' => ['sometimes', 'integer', 'min:0'],
            'pages.*.screenshot' => ['required', 'string', 'max:255'],
            'pages.*.width' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'pages.*.height' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
            'pages.*.sections' => ['sometimes', 'array', 'max:200'],
            'pages.*.sections.*.order' => ['sometimes', 'integer', 'min:0'],
            'pages.*.sections.*.type' => ['required', Rule::in(LibrarySection::TYPES)],
            'pages.*.sections.*.box' => ['required', 'array'],
            'pages.*.sections.*.box.y' => ['required', 'numeric', 'min:0'],
            'pages.*.sections.*.box.h' => ['required', 'numeric', 'gt:0'],
            'pages.*.sections.*.layoutId' => ['sometimes', 'nullable', 'string', 'regex:'.LibrarySection::LAYOUT_PATTERN],
            'pages.*.sections.*.score' => ['sometimes', 'nullable', 'numeric'],
            'pages.*.sections.*.status' => ['sometimes', 'nullable', Rule::in(LibrarySection::STATUSES)],
            'pages.*.sections.*.screenshot' => ['sometimes', 'nullable', 'string', 'max:255'],
            'pages.*.sections.*.hint' => ['sometimes', 'nullable', 'array'],
        ]);
        if ($validator->fails()) {
            throw ValidationException::withMessages(collect($validator->errors()->toArray())
                ->mapWithKeys(fn ($messages, $key) => ["site.{$key}" => $messages])->all());
        }

        return $json;
    }

    /** Drafts are only there for the people who run Blokmix. */
    private function visible(string $slug): LibrarySite
    {
        $site = LibrarySite::where('slug', $slug)->firstOrFail();
        abort_unless($site->isPublished() || $this->isOwner(), 404);

        return $site;
    }

    private function isOwner(): bool
    {
        return Gate::allows('run-blokmix');
    }

    private function owner(): void
    {
        abort_unless($this->isOwner(), 403, 'Only the people who run Blokmix curate the library.');
    }
}
