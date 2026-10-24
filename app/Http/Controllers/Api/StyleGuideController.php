<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StyleGuide;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

/** Your saved style guides: list them, save one (a mix's guide, under a name), or delete one. */
class StyleGuideController extends Controller
{
    private const MAX_BYTES = 256 * 1024;

    public function index(Request $request): JsonResponse
    {
        return response()->json($request->user()->styleGuides()->latest('updated_at')->get()->map(fn (StyleGuide $g) => $this->card($g)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'guide' => ['required', 'array'],
            'guide.base' => ['present', 'array'],
        ]);
        // The guide as sent: validate() would keep only the keys that have rules (its base).
        $data['guide'] = $request->input('guide');
        $name = trim($data['name']);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Give the style guide a name.']);
        }
        if (strlen(json_encode($data['guide'])) > self::MAX_BYTES) {
            throw ValidationException::withMessages(['guide' => 'That style guide is too big (256 KB at most).']);
        }

        // Saving under a name you already use updates that guide.
        $guide = $request->user()->styleGuides()->updateOrCreate(['name' => $name], ['guide' => $data['guide']]);

        return response()->json($this->card($guide), $guide->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request, StyleGuide $guide): Response
    {
        abort_unless($guide->user_id === $request->user()->id, 404);
        $guide->delete();

        return response()->noContent();
    }

    private function card(StyleGuide $g): array
    {
        return ['id' => $g->id, 'name' => $g->name, 'guide' => $g->guide, 'updated_at' => $g->updated_at];
    }
}
