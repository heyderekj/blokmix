<?php

namespace App\Http\Controllers;

use App\Enums\MixRole;
use App\Models\Mix;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Mixes as pages: yours and the ones shared with you, and one open on the
 * board. "local" is the mix kept in this browser only.
 */
class MixController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('mixes/index', [
            'mixes' => $request->user()->mixes()
                ->withCount('versions')
                ->latest('updated_at')
                ->get(['mixes.id', 'mixes.name', 'mixes.updated_at'])
                ->map(fn (Mix $m) => [
                    'id' => $m->id,
                    'name' => $m->name,
                    'updated_at' => $m->updated_at,
                    'versions' => $m->versions_count,
                    'role' => $m->pivot->role,
                ]),
        ]);
    }

    public function local(): Response
    {
        return Inertia::render('mixes/show', ['mix' => ['id' => 'local'], 'role' => MixRole::Owner->value]);
    }

    public function show(Request $request, Mix $mix): Response
    {
        $role = $mix->roleOf($request->user());
        abort_unless($role, 404);

        return Inertia::render('mixes/show', ['mix' => $mix->load('versions')->toBoard(), 'role' => $role->value]);
    }

    /** A new, blank mix you own; the board fills it in on first save. */
    public function store(Request $request): RedirectResponse
    {
        $mix = Mix::create(['name' => 'Untitled mix']);
        $mix->admit($request->user(), MixRole::Owner);

        return redirect()->route('mixes.show', $mix);
    }
}
