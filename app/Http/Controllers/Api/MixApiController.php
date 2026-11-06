<?php

namespace App\Http\Controllers\Api;

use App\Enums\MixRole;
use App\Http\Controllers\Controller;
use App\Models\Mix;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Where the board saves a mix. Saves are optimistic: each names the lock it last
 * read (If-Match) and gets the next one back; a save from an older lock is
 * refused with 412 and the mix as it is now, so nothing is overwritten unseen.
 */
class MixApiController extends Controller
{
    /** Big enough for a site with many versions; versions are sent only when they change. */
    private const MAX_BYTES = 20 * 1024 * 1024;

    public function show(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);

        return $this->withLock(response()->json($mix->load('versions', 'drafts')->toBoard()), $mix->lock_version);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guardSize($request);
        // Importing a file and saving the browser's mix start a mix too.
        $why = $request->user()->mixRefusal();
        abort_if($why !== null, 403, (string) $why);
        $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'data' => ['nullable', 'array'],
            'versions' => ['nullable', 'array'],
            'versions.*' => ['array'],
            'versions.*.letter' => ['required', 'string', 'max:20'],
            'drafts' => ['nullable', 'array', 'max:'.Mix::MAX_DRAFTS],
            'drafts.*' => ['array'],
            'drafts.*.letter' => ['required', 'string', 'max:8'],
        ]);
        // The payload as sent: validate() would keep only the keys that have rules (a version's letter).
        $input = $request->only(['name', 'data', 'versions', 'drafts']);

        $mix = DB::transaction(function () use ($input, $request) {
            $mix = Mix::create(['name' => $input['name'], 'data' => $input['data'] ?? null]);
            $mix->admit($request->user(), MixRole::Owner);
            foreach ($input['versions'] ?? [] as $key => $node) {
                $mix->versions()->create(['key' => (string) $key, 'letter' => $node['letter'], 'node' => $node]);
            }
            foreach ($input['drafts'] ?? [] as $key => $node) {
                $mix->drafts()->create(['key' => (string) $key, 'letter' => $node['letter'], 'node' => $node]);
            }

            return $mix;
        });

        return $this->withLock(response()->json($mix->load('versions', 'drafts')->toBoard(), 201), $mix->lock_version);
    }

    public function update(Request $request, Mix $mix): JsonResponse
    {
        $role = $mix->roleOf($request->user());
        abort_unless($role, 404);
        $this->guardSize($request);
        $lock = (int) trim((string) $request->header('If-Match'), '"W/');
        abort_if($lock < 1, 428, 'Send If-Match with the lock you last read.');

        $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'data' => ['sometimes', 'nullable', 'array'],
            'versions' => ['sometimes', 'array'],
            'versions.put' => ['sometimes', 'array'],
            'versions.put.*' => ['array'],
            'versions.put.*.letter' => ['required', 'string', 'max:20'],
            'versions.remove' => ['sometimes', 'array'],
            'versions.remove.*' => ['string'],
            'drafts' => ['sometimes', 'array'],
            'drafts.put' => ['sometimes', 'array'],
            'drafts.put.*' => ['array'],
            'drafts.put.*.letter' => ['required', 'string', 'max:8'],
            'drafts.remove' => ['sometimes', 'array'],
            'drafts.remove.*' => ['string'],
        ]);
        $input = $request->only(['name', 'data', 'versions', 'drafts']);
        if (! $mix->changeableBy($role)) {
            // Viewers (and everyone, on an archived mix) leave marks and change nothing else: keep only their notes, on top of the mix as saved.
            $input = array_key_exists('data', $input) && is_array($input['data'])
                ? ['data' => [...($mix->data ?? []), 'notes' => $input['data']['notes'] ?? ($mix->data['notes'] ?? [])]]
                : [];
        }

        // A mix holds a few drafts: more than that is refused before anything is saved.
        if (! empty($input['drafts']['put'])) {
            $keys = $mix->drafts()->pluck('key')->merge(array_map('strval', array_keys($input['drafts']['put'])))->unique()
                ->diff($input['drafts']['remove'] ?? []);
            abort_if($keys->count() > Mix::MAX_DRAFTS, 422, 'A mix holds up to '.Mix::MAX_DRAFTS.' drafts.');
        }

        $saved = DB::transaction(function () use ($mix, $lock, $input) {
            $changes = ['lock_version' => $lock + 1, 'updated_at' => now()];
            if (array_key_exists('name', $input)) {
                $changes['name'] = $input['name'];
            }
            if (array_key_exists('data', $input)) {
                $changes['data'] = $input['data'] === null ? null : json_encode($input['data']);
            }
            // Only the save that read the current lock gets through.
            if (Mix::whereKey($mix->id)->where('lock_version', $lock)->update($changes) === 0) {
                return false;
            }
            foreach ($input['versions']['put'] ?? [] as $key => $node) {
                $mix->versions()->updateOrCreate(['key' => (string) $key], ['letter' => $node['letter'], 'node' => $node]);
            }
            if (! empty($input['versions']['remove'])) {
                $mix->versions()->whereIn('key', $input['versions']['remove'])->delete();
            }
            foreach ($input['drafts']['put'] ?? [] as $key => $node) {
                $mix->drafts()->updateOrCreate(['key' => (string) $key], ['letter' => $node['letter'], 'node' => $node]);
            }
            if (! empty($input['drafts']['remove'])) {
                $mix->drafts()->whereIn('key', $input['drafts']['remove'])->delete();
            }

            return true;
        });

        $mix->refresh()->load('versions', 'drafts');
        if (! $saved) {
            return $this->withLock(response()->json(['message' => 'This mix changed since you last read it.', 'mix' => $mix->toBoard()], 412), $mix->lock_version);
        }

        return $this->withLock(response()->json(['lock' => $mix->lock_version, 'updated_at' => $mix->updated_at]), $mix->lock_version);
    }

    /**
     * Rename from the gallery. Only the name changes, and the lock stays as it is, so a board open on this mix
     * keeps saving (it shows the new name after a reload).
     */
    public function rename(Request $request, Mix $mix): JsonResponse
    {
        $role = $mix->roleOf($request->user());
        abort_unless($role, 404);
        abort_unless($role->canEdit(), 403, 'Viewers can’t rename a mix.');
        $name = trim($request->validate(['name' => ['required', 'string', 'max:120']])['name']);
        abort_if($name === '', 422, 'Give the mix a name.');
        Mix::whereKey($mix->id)->update(['name' => $name, 'updated_at' => now()]);

        return response()->json(['name' => $name]);
    }

    /**
     * A copy of a mix you can open: its pages, style guide, words, notes, versions and uploads, as a new mix you own
     * ("… copy"). Sharing doesn't come along.
     */
    public function duplicate(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);
        $why = $request->user()->mixRefusal() ?? $request->user()->uploadRefusal((int) $mix->assets()->sum('size'));
        abort_if($why !== null, 403, (string) $why);
        $disk = Storage::disk(config('blokmix.uploads_disk'));

        $copy = DB::transaction(function () use ($mix, $request, $disk) {
            $copy = Mix::create(['name' => Str::limit($mix->name.' copy', 120, ''), 'data' => $mix->data, 'schema' => $mix->schema]);
            $copy->admit($request->user(), MixRole::Owner);
            foreach ($mix->versions as $v) {
                $copy->versions()->create(['key' => $v->key, 'letter' => $v->letter, 'node' => $v->node]);
            }
            foreach ($mix->drafts as $d) {
                $copy->drafts()->create(['key' => $d->key, 'letter' => $d->letter, 'node' => $d->node]);
            }
            // Uploads are copied on the disk too, so deleting either mix leaves the other's intact.
            $copyFile = function (?string $path) use ($disk, $copy): ?string {
                if ($path === null) {
                    return null;
                }
                $to = "mixes/{$copy->id}/".basename($path);
                if ($disk->exists($path)) {
                    $disk->copy($path, $to);
                }

                return $to;
            };
            foreach ($mix->assets as $a) {
                $copy->assets()->create([...$a->only(['key', 'kind', 'name', 'mime', 'width', 'height', 'size']), 'path' => $copyFile($a->path), 'poster_path' => $copyFile($a->poster_path)]);
            }

            return $copy;
        });

        return $this->withLock(response()->json($copy->load('versions', 'drafts')->toBoard(), 201), $copy->lock_version);
    }

    /** Archive a mix: it stays, read-only, and stops taking one of its owner's mixes. */
    public function archive(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);
        abort_unless($request->user()->can('delete', $mix), 403, 'Only the owner can archive a mix.');
        if (! $mix->isArchived()) {
            Mix::whereKey($mix->id)->update(['archived_at' => now()]);
        }

        return response()->json(['archived' => true]);
    }

    /** Bring an archived mix back, when one of its owner's mixes is free. */
    public function unarchive(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);
        abort_unless($request->user()->can('delete', $mix), 403, 'Only the owner can bring a mix back.');
        if ($mix->isArchived()) {
            $why = $request->user()->mixRefusal();
            abort_if($why !== null, 403, (string) $why);
            Mix::whereKey($mix->id)->update(['archived_at' => null]);
        }

        return response()->json(['archived' => false]);
    }

    public function destroy(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);
        abort_unless($request->user()->can('delete', $mix), 403, 'Only the owner can delete a mix.');
        $mix->delete();

        return response()->json(null, 204);
    }

    private function withLock(JsonResponse $response, int $lock): JsonResponse
    {
        return $response->setEtag((string) $lock);
    }

    private function guardSize(Request $request): void
    {
        abort_if(strlen($request->getContent()) > self::MAX_BYTES, 413, 'This mix is too big to save in one go.');
    }
}
