<?php

namespace App\Http\Controllers\Api;

use App\Models\Mix;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IterationController
{
    public function send(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->changeableBy($mix->roleOf($request->user())) && $mix->ships(), 403);
        $data = $request->validate(['version' => 'required|string|max:80', 'packet' => 'required|string|json|max:6000000']);
        $version = $mix->versions()->where('key', $data['version'])->firstOrFail()->node;
        abort_unless($version['kind'] === 'snapshot', 422);
        $id = (string) Str::uuid();
        DB::table('agent_handoffs')->insert(['id' => $id, 'mix_id' => $mix->id, 'user_id' => $request->user()->id, 'version' => $data['version'], 'draft' => $version['draftId'] ?? 'draft_a', 'packet' => $data['packet'], 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['id' => $id], 201);
    }

    public function inbox(Request $request, Mix $mix): JsonResponse
    {
        abort_unless($mix->roleOf($request->user()), 403);
        $after = $request->validate(['after' => 'sometimes|integer|min:0'])['after'] ?? 0;
        $items = DB::table('agent_returns')->join('agent_handoffs as h', 'h.id', '=', 'agent_returns.handoff')
            ->where('h.mix_id', $mix->id)->where('agent_returns.id', '>', $after)
            ->orderBy('agent_returns.id')->limit(32)->get(['agent_returns.id', 'payload']);

        return response()->json(['cursor' => $items->last()->id ?? (int) $after, 'items' => $items->map(fn ($item) => json_decode($item->payload))]);
    }
}
