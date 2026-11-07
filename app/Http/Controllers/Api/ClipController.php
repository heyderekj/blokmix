<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Clip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Captured clips on an account. You get your own and those of everyone you share a
 * mix with, so a shared mix opens with all its sections. The board lints a clip
 * before it's sent; here the paths and sizes are checked.
 */
class ClipController extends Controller
{
    private const PATH = '/^samples\/(clips\/([a-z]+)\/([\w-]+)\/(clip\.html|clip\.css|motion\.css|clip\.json)|sources\/[a-z0-9-]+\.json)$/';

    private const MAX_BYTES = 512 * 1024;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        // People who share at least one mix with you, and you.
        $people = $user->mixes()->with('members:id')->get()->flatMap(fn ($m) => $m->members->pluck('id'))->push($user->id)->unique();

        return response()->json(Clip::whereIn('user_id', $people)->orderBy('clip_id')->get(['clip_id', 'files'])->map(fn (Clip $c) => ['id' => $c->clip_id, 'files' => $c->files]));
    }

    public function store(Request $request): JsonResponse
    {
        $files = $request->validate(['files' => ['required', 'array', 'max:12'], 'files.*' => ['string']])['files'];
        if (strlen(json_encode($files)) > self::MAX_BYTES) {
            throw ValidationException::withMessages(['files' => 'That clip is too big (512 KB at most).']);
        }

        $ids = [];
        foreach (array_keys($files) as $path) {
            if (! preg_match(self::PATH, $path, $m)) {
                throw ValidationException::withMessages(['files' => "“{$path}” isn’t a clip file."]);
            }
            if (! empty($m[2])) {
                $ids[] = "{$m[2]}.{$m[3]}";
            }
        }
        $ids = array_values(array_unique($ids));
        if (count($ids) !== 1) {
            throw ValidationException::withMessages(['files' => 'Send one clip at a time.']);
        }

        $clip = $request->user()->clips()->updateOrCreate(['clip_id' => $ids[0]], ['files' => $files]);

        return response()->json(['id' => $clip->clip_id], 201);
    }
}
