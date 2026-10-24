<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

/**
 * Mixes. Until they're stored on the server, the one mix lives in this browser
 * (the board keeps it in localStorage), so it's the only one there is: "local".
 */
class MixController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('mixes/index', [
            // Saved on the server: none yet.
            'mixes' => [],
        ]);
    }

    public function show(string $mix): Response
    {
        abort_unless($mix === 'local', 404);

        return Inertia::render('mixes/show', [
            'mix' => ['id' => $mix],
        ]);
    }
}
