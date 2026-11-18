<?php

namespace App\Services;

use App\Models\Mix;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AgentIterations
{
    public function handoff(User $user, string $id): object
    {
        $row = DB::table('agent_handoffs')->where('id', $id)->where('user_id', $user->id)->first();
        abort_unless($row, 404);
        $mix = Mix::findOrFail($row->mix_id);
        abort_unless($mix->changeableBy($mix->roleOf($user)) && $mix->ships(), 403);
        abort_unless($mix->versions()->where('key', $row->version)->exists(), 410);

        return $row;
    }

    public function submit(object $handoff, object $bundle): void
    {
        $payload = json_decode(json_encode($bundle, JSON_THROW_ON_ERROR), true);
        abort_unless(($payload['format'] ?? '') === 'blokmix.return/v1' && Str::isUuid($payload['id'] ?? '') && ($payload['base'] ?? '') === $handoff->version, 422);
        abort_if(isset($payload['mix']) && $payload['mix'] !== $handoff->mix_id, 422);
        abort_if(isset($payload['draft']) && $payload['draft'] !== $handoff->draft, 422);
        $bundle->mix = $handoff->mix_id;
        $bundle->draft = $handoff->draft;
        IterationSchema::check('agent-return', $bundle);
        $json = json_encode($bundle, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        abort_if(strlen($json) > 60000, 413);
        $key = ['handoff' => $handoff->id, 'submission' => $payload['id']];
        DB::transaction(function () use ($handoff, $key, $json) {
            DB::table('agent_handoffs')->where('id', $handoff->id)->lockForUpdate()->first();
            $old = DB::table('agent_returns')->where($key)->value('payload');
            if ($old !== null) {
                abort_unless($old === $json, 409);

                return;
            }
            abort_if(DB::table('agent_returns')->where('handoff', $handoff->id)->count() >= 30, 429);
            DB::table('agent_returns')->insert($key + ['payload' => $json]);
        });
    }
}
