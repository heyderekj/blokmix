<?php

namespace App\Http\Controllers;

use App\Models\LibrarySection;
use App\Models\LibrarySite;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Curating the site library, for the people who run Blokmix (Gate run-blokmix): every site with its sections matched
 * or needing a layout, and one site's pages with their section boxes. Everyone else gets a 404. Changes go through
 * Api\LibraryController.
 */
class LibraryAdminController extends Controller
{
    public function index(?string $slug = null): Response
    {
        abort_unless(Gate::allows('run-blokmix'), 404);
        $site = $slug === null ? null : LibrarySite::where('slug', $slug)->firstOrFail();

        return Inertia::render('library/admin', [
            'sites' => LibrarySite::query()->forCards()->latest('updated_at')->get()->map->summary()->values(),
            'site' => $site?->full(true),
            'types' => LibrarySection::TYPES,
        ]);
    }
}
