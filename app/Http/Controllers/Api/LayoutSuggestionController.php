<?php

namespace App\Http\Controllers\Api;

use App\Models\Mix;
use App\Services\IterationSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class LayoutSuggestionController
{
    public function index(Request $request): JsonResponse
    {
        $pending = $request->boolean('pending');
        if ($pending) {
            Gate::authorize('run-blokmix');
        }
        $rows = DB::table('layout_suggestions')->where('status', $pending ? 'pending' : 'approved')->latest('id')->get(['id', 'recipe']);

        return response()->json($rows->map(fn ($row) => ['id' => $row->id, 'recipe' => json_decode($row->recipe)]));
    }

    public function store(Request $request, Mix $mix): JsonResponse
    {
        Gate::authorize('share', $mix);
        abort_if($mix->isArchived(), 403);
        $recipe = json_decode($request->getContent())->recipe ?? null;
        $json = json_encode($recipe, JSON_THROW_ON_ERROR);
        abort_if(strlen($json) > 60000, 413);
        IterationSchema::check('layout-recipe', $recipe);
        $id = DB::table('layout_suggestions')->insertGetId(['mix_id' => $mix->id, 'title' => $recipe->title, 'recipe' => $json, 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['id' => $id], 201);
    }

    public function review(Request $request, int $id): JsonResponse
    {
        Gate::authorize('run-blokmix');
        $status = $request->validate(['status' => 'required|in:approved,declined'])['status'];
        $count = DB::table('layout_suggestions')->where('id', $id)->where('status', 'pending')->update(['status' => $status, 'updated_at' => now()]);
        abort_unless($count, 409);

        return response()->json(['status' => $status]);
    }
}
