<?php

namespace App\Http\Controllers;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\MixShareLink;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Sharing a mix: links that add people with a role, and the people already in it.
 * Members can see who else is in a mix; only the owner changes it.
 */
class ShareController extends Controller
{
    /** Opening a share link: new people sign up first, then land in the mix. */
    public function join(Request $request, string $token): RedirectResponse
    {
        $link = MixShareLink::where('token', $token)->whereNull('revoked_at')->with('mix')->first();
        if (! $link) {
            return redirect()->route($request->user() ? 'mixes.index' : 'login')->with('flash', 'That share link no longer works. Ask for a new one.');
        }
        if (! $request->user()) {
            $request->session()->put('invite', ['mix' => $link->mix->name, 'role' => $link->role->value]);

            return redirect()->guest(route('register'));
        }
        $link->mix->admit($request->user(), $link->role);

        return redirect()->route('mixes.show', $link->mix);
    }

    public function index(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->roleOf($request->user()), 404);
        $owner = $request->user()->can('share', $mix);

        return response()->json([
            'members' => $mix->members()->orderBy('mix_members.created_at')->get()->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->pivot->role,
                'you' => $u->is($request->user()),
            ]),
            'links' => $owner ? $mix->shareLinks()->whereNull('revoked_at')->latest()->get()->map(fn (MixShareLink $l) => [
                'id' => $l->id,
                'role' => $l->role->value,
                'url' => $l->url(),
            ]) : [],
            'can_share' => $owner,
        ]);
    }

    public function createLink(Request $request, Mix $mix): JsonResponse
    {
        $this->owner($request, $mix);
        $role = $request->validate(['role' => ['required', Rule::in([MixRole::Editor->value, MixRole::Viewer->value])]])['role'];
        $link = $mix->shareLinks()->create(['token' => MixShareLink::newToken(), 'role' => $role, 'created_by' => $request->user()->id]);

        return response()->json(['id' => $link->id, 'role' => $link->role->value, 'url' => $link->url()], 201);
    }

    public function revokeLink(Request $request, Mix $mix, MixShareLink $link): JsonResponse
    {
        $this->owner($request, $mix);
        abort_unless($link->mix_id === $mix->id, 404);
        $link->forceFill(['revoked_at' => now()])->save();

        return response()->json(null, 204);
    }

    public function updateMember(Request $request, Mix $mix, User $user): JsonResponse
    {
        $this->owner($request, $mix);
        abort_unless($mix->roleOf($user), 404);
        abort_if($user->is($request->user()), 422, 'You can’t change your own role.');
        $role = $request->validate(['role' => ['required', Rule::enum(MixRole::class)]])['role'];
        $mix->members()->updateExistingPivot($user->id, ['role' => $role]);

        return response()->json(['id' => $user->id, 'role' => $role]);
    }

    public function removeMember(Request $request, Mix $mix, User $user): JsonResponse
    {
        $this->owner($request, $mix);
        abort_if($user->is($request->user()), 422, 'An owner can’t remove themselves.');
        $mix->members()->detach($user->id);

        return response()->json(null, 204);
    }

    private function owner(Request $request, Mix $mix): void
    {
        abort_unless($mix->roleOf($request->user()), 404);
        abort_unless($request->user()->can('share', $mix), 403, 'Only the owner can share this mix.');
    }
}
