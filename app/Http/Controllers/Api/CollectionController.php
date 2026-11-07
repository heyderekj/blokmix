<?php

namespace App\Http\Controllers\Api;

use App\Enums\MixRole;
use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Your collections, and the ones mixes you're in bind. Saves are optimistic like a mix's: each names the lock it last
 * read (If-Match) and gets the next one back; a save from an older lock gets 412 and the collection as it is now.
 * Reading or editing someone else's collection goes through a mix (`?mix=<id>`) that binds it: see Collection::roleOf.
 */
class CollectionController extends Controller
{
    private const MAX_BYTES = 2 * 1024 * 1024;

    private const SLUG = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /** Yours, then the ones you reach through a mix (`?mix` for one mix's, otherwise every mix you're in). */
    public function index(Request $request): JsonResponse
    {
        $me = $request->user();
        $mix = $this->mixFrom($request);
        $found = $me->collections()->with('user')->orderBy('name')->get()->map(fn (Collection $c) => $c->toBoard())->all();
        $seen = array_flip(array_column($found, 'id'));
        $mixes = $mix ? collect([$mix]) : $me->mixes()->with('members')->get();
        foreach ($mixes as $m) {
            foreach ($this->sharedThrough($m, $me) as [$collection, $role]) {
                if (! isset($seen[$collection->id])) {
                    $seen[$collection->id] = true;
                    $found[] = [...$collection->toBoard($role), 'mix' => $m->id];
                }
            }
        }

        return response()->json($found);
    }

    public function show(Request $request, Collection $collection): JsonResponse
    {
        $role = $this->roleIn($request, $collection);

        return $this->withLock(response()->json($collection->load('user')->toBoard($role)), $collection->lock);
    }

    public function store(Request $request): JsonResponse
    {
        $this->guardSize($request);
        $me = $request->user();
        $request->validate([
            'id' => ['nullable', 'ulid'],
            'slug' => ['required', 'string', 'max:64', 'regex:'.self::SLUG],
            'name' => ['required', 'string', 'max:120'],
            'schema' => ['required', 'array'],
            'schema.fields' => ['present', 'array'],
            'schema.fields.*' => ['array'],
            'schema.fields.*.key' => ['required', 'string', 'max:64'],
            'schema.fields.*.type' => ['required', 'string', 'max:32'],
            'entries' => ['sometimes', 'array'],
            'entries.*' => ['array'],
            'entries.*.id' => ['required', 'string', 'max:64'],
        ]);
        // The payload as sent: validate() would keep only the keys that have rules.
        $input = $request->only(['id', 'slug', 'name', 'schema', 'entries']);
        if ($clash = $this->slugClash($me, $input['slug'])) {
            return $clash;
        }
        abort_if(isset($input['id']) && Collection::whereKey($input['id'])->exists(), 409, 'There’s already a collection with that id.');

        $collection = new Collection(['slug' => $input['slug'], 'name' => $input['name'], 'schema' => $input['schema'], 'entries' => $input['entries'] ?? []]);
        if (isset($input['id'])) {
            $collection->id = strtolower($input['id']);
        }
        $collection->user()->associate($me)->save();

        return $this->withLock(response()->json($collection->toBoard(), 201), $collection->lock);
    }

    public function update(Request $request, Collection $collection): JsonResponse
    {
        $role = $this->roleIn($request, $collection);
        $this->guardSize($request);
        $lock = (int) trim((string) $request->header('If-Match'), '"W/');
        abort_if($lock < 1, 428, 'Send If-Match with the lock you last read.');
        abort_unless($role->canEdit(), 403, 'Viewers can’t change a collection.');

        $request->validate([
            'slug' => ['sometimes', 'string', 'max:64', 'regex:'.self::SLUG],
            'name' => ['sometimes', 'string', 'max:120'],
            'schema' => ['sometimes', 'array'],
            'schema.fields' => ['present_with:schema', 'array'],
            'schema.fields.*' => ['array'],
            'schema.fields.*.key' => ['required', 'string', 'max:64'],
            'schema.fields.*.type' => ['required', 'string', 'max:32'],
            'entries' => ['sometimes', 'array'],
            'entries.*' => ['array'],
            'entries.*.id' => ['required', 'string', 'max:64'],
        ]);
        $input = $request->only(['slug', 'name', 'schema', 'entries']);
        if ($role !== MixRole::Owner) {
            // Editors through a mix change entries; the fields, name and slug are the owner's. Sending them unchanged is fine.
            foreach (['slug', 'name', 'schema'] as $key) {
                if (array_key_exists($key, $input) && $input[$key] != $collection->{$key}) {
                    abort(403, 'Only the collection’s owner changes its fields, name and address.');
                }
                unset($input[$key]);
            }
        }
        $owner = $collection->user;
        if (isset($input['slug']) && $input['slug'] !== $collection->slug && ($clash = $this->slugClash($owner, $input['slug']))) {
            return $clash;
        }

        $changes = ['lock' => $lock + 1, 'updated_at' => now()];
        foreach ($input as $key => $value) {
            $changes[$key] = is_array($value) ? json_encode($value) : $value;
        }
        // Only the save that read the current lock gets through.
        $saved = Collection::whereKey($collection->id)->where('lock', $lock)->update($changes) > 0;

        $collection->refresh()->load('user');
        if (! $saved) {
            return $this->withLock(response()->json(['message' => 'This collection changed since you last read it.', 'collection' => $collection->toBoard($role)], 412), $collection->lock);
        }

        return $this->withLock(response()->json(['lock' => $collection->lock, 'updated_at' => $collection->updated_at]), $collection->lock);
    }

    public function destroy(Request $request, Collection $collection): JsonResponse
    {
        $role = $this->roleIn($request, $collection);
        abort_unless($role === MixRole::Owner, 403, 'Only the owner can delete a collection.');
        $collection->delete();
        Storage::disk(config('blokmix.uploads_disk'))->deleteDirectory("collections/{$collection->id}");

        return response()->json(null, 204);
    }

    /** What you can do with this collection, from `?mix` when it isn't yours; 404 when nothing. */
    private function roleIn(Request $request, Collection $collection): MixRole
    {
        $role = $collection->roleOf($request->user(), $this->mixFrom($request));
        abort_unless($role, 404);

        return $role;
    }

    /** The mix named by `?mix` (its id or short address), when you're in it; 404 when you're not. */
    private function mixFrom(Request $request): ?Mix
    {
        $id = $request->query('mix');
        if (! is_string($id) || $id === '') {
            return null;
        }
        $mix = Mix::where('id', strtolower($id))->orWhere('short', strtolower($id))->first();
        abort_unless($mix?->roleOf($request->user()), 404);

        return $mix;
    }

    /** Other people's collections a mix binds, with what $me may do with each. */
    private function sharedThrough(Mix $mix, User $me): array
    {
        $slugs = Collection::boundIn($mix);
        if ($slugs === []) {
            return [];
        }

        return Collection::with('user')->whereIn('slug', $slugs)->where('user_id', '!=', $me->id)
            ->whereIn('user_id', $mix->members()->wherePivotIn('role', [MixRole::Owner->value, MixRole::Editor->value])->select('users.id'))
            ->orderBy('name')->get()
            ->map(fn (Collection $c) => [$c, $c->roleOf($me, $mix)])
            ->filter(fn ($pair) => $pair[1] !== null)
            ->values()->all();
    }

    private function slugClash(User $owner, string $slug): ?JsonResponse
    {
        if (! $owner->collections()->where('slug', $slug)->exists()) {
            return null;
        }
        $message = 'There’s already a collection at that address.';

        return response()->json(['message' => $message, 'errors' => ['slug' => [$message]]], 409);
    }

    private function withLock(JsonResponse $response, int $lock): JsonResponse
    {
        return $response->setEtag((string) $lock);
    }

    private function guardSize(Request $request): void
    {
        abort_if(strlen($request->getContent()) > self::MAX_BYTES, 413, 'This collection is too big to save in one go (2 MB at most).');
    }
}
