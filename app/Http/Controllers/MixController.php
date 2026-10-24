<?php

namespace App\Http\Controllers;

use App\Models\Mix;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Mixes as pages: the list, and one open on the board. "local" is the mix kept
 * in this browser only (from before mixes were saved here).
 */
class MixController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('mixes/index', [
            'mixes' => Mix::query()
                ->withCount('versions')
                ->latest('updated_at')
                ->get(['id', 'name', 'updated_at'])
                ->map(fn (Mix $m) => ['id' => $m->id, 'name' => $m->name, 'updated_at' => $m->updated_at, 'versions' => $m->versions_count]),
        ]);
    }

    public function local(): Response
    {
        return Inertia::render('mixes/show', ['mix' => ['id' => 'local']]);
    }

    public function show(Mix $mix): Response
    {
        return Inertia::render('mixes/show', ['mix' => $mix->load('versions')->toBoard()]);
    }

    /** A new, blank mix; the board fills it in on first save. */
    public function store(): RedirectResponse
    {
        $mix = Mix::create(['name' => 'Untitled mix']);

        return redirect()->route('mixes.show', $mix);
    }
}
