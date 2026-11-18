<?php

namespace App\Mcp\Tools;

use App\Services\AgentIterations;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tool;

#[Name('submit_changes')]
#[Description('Submit a return for review. Encode the return object from get_handoff as JSON and reuse its UUID when retrying.')]
class SubmitChanges extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return ['handoff' => $schema->string()->required(), 'bundle' => $schema->string()->required()];
    }

    public function handle(Request $request, AgentIterations $service): Response
    {
        $input = $request->validate(['handoff' => 'required|uuid', 'bundle' => 'required|string|json|max:60000']);
        $bundle = json_decode($input['bundle']);
        abort_unless(is_object($bundle), 422);
        $service->submit($service->handoff($request->user(), $input['handoff']), $bundle);

        return Response::text('Submitted to the originating draft for review.');
    }
}
