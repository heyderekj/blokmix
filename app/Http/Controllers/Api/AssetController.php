<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mix;
use App\Models\MixAsset;
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
            'size' => $request->file('file')->getSize(),
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
        ]);
    }
}
