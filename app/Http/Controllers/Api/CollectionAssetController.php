<?php

namespace App\Http\Controllers\Api;

use App\Enums\MixRole;
use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Mix;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * A collection's uploads, like a mix's (AssetController). Whoever can read the collection reads them; its owner, and
 * editors through a mix that binds it (`?mix`), add them, and they count toward the owner's room.
 */
class CollectionAssetController extends Controller
{
    public function index(Request $request, Collection $collection): JsonResponse
    {
        $this->roleIn($request, $collection);

        return response()->json($collection->assets()->get()->map->toBoard());
    }

    public function store(Request $request, Collection $collection): JsonResponse
    {
        abort_unless($this->roleIn($request, $collection)->canEdit(), 403, 'Viewers can’t add images.');
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

        // Uploads count toward the collection owner's room, whoever adds them; replacing one only counts the difference.
        $owner = $collection->user;
        $was = (int) $collection->assets()->where('key', $input['id'])->value('size');
        $why = $owner->uploadRefusal($request->file('file')->getSize() - $was);
        if ($why !== null && $owner->isNot($request->user())) {
            $why = 'This collection’s owner is out of room for images and video. It stays in this browser.';
        }
        abort_if($why !== null, 403, (string) $why);

        $disk = Storage::disk(config('blokmix.uploads_disk'));
        $dir = "collections/{$collection->id}";
        $path = $disk->putFileAs($dir, $request->file('file'), $input['id']);
        $poster = $request->hasFile('poster') ? $disk->putFileAs($dir, $request->file('poster'), $input['id'].'-poster') : null;

        $asset = $collection->assets()->updateOrCreate(['key' => $input['id']], [
            'kind' => $input['kind'],
            'name' => $input['name'],
            'mime' => $input['mime'],
            'width' => $input['width'] ?? 0,
            'height' => $input['height'] ?? 0,
            'size' => $request->file('file')->getSize(),
            'path' => $path,
            'poster_path' => $poster,
        ]);

        return response()->json($asset->toBoard(), 201);
    }

    public function show(Request $request, Collection $collection, string $key): StreamedResponse
    {
        return $this->stream($request, $collection, $key, false);
    }

    public function poster(Request $request, Collection $collection, string $key): StreamedResponse
    {
        return $this->stream($request, $collection, $key, true);
    }

    private function stream(Request $request, Collection $collection, string $key, bool $poster): StreamedResponse
    {
        $this->roleIn($request, $collection);
        $asset = $collection->assets()->where('key', $key)->firstOrFail();
        $path = $poster ? $asset->poster_path : $asset->path;
        abort_unless($path, 404);

        return Storage::disk(config('blokmix.uploads_disk'))->response($path, null, [
            'Content-Type' => $poster ? 'image/webp' : $asset->mime,
            'Cache-Control' => 'private, max-age=31536000, immutable',
        ]);
    }

    /** What you can do with this collection, from `?mix` when it isn't yours; 404 when nothing. */
    private function roleIn(Request $request, Collection $collection): MixRole
    {
        $id = $request->query('mix');
        $mix = is_string($id) && $id !== '' ? Mix::where('id', strtolower($id))->orWhere('short', strtolower($id))->first() : null;
        $role = $collection->roleOf($request->user(), $mix);
        abort_unless($role, 404);

        return $role;
    }
}
