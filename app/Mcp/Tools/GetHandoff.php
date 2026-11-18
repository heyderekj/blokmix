<?php

namespace App\Mcp\Tools;

use App\Services\AgentIterations;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Tool;

#[Name('get_handoff')]
#[Description('Read the explicitly sent version, changes, and return format.')]
class GetHandoff extends Tool
{
    public function schema(JsonSchema $schema): array
    {
        return [
            'handoff' => $schema->string()->required(),
            'file' => $schema->string()->description('A file from the handoff index.'),
            'offset' => $schema->integer()->description('Continue at nextOffset from the last response.'),
        ];
    }

    public function handle(Request $request, AgentIterations $service): Response
    {
        $input = $request->validate(['handoff' => 'required|uuid', 'file' => 'sometimes|string|max:512', 'offset' => 'sometimes|integer|min:0']);
        $packet = (array) json_decode($service->handoff($request->user(), $input['handoff'])->packet, flags: JSON_THROW_ON_ERROR);
        $files = (array) ($packet['files'] ?? []);
        unset($packet['files']);
        foreach (['snapshot', 'changes', 'layouts', 'fields', 'returnSchema'] as $key) {
            if (isset($packet[$key])) {
                $files['handoff/'.$key.'.json'] = json_encode($packet[$key], JSON_THROW_ON_ERROR);
                unset($packet[$key]);
            }
        }
        if (! isset($input['file'])) {
            if ($files) {
                $packet['files'] = array_keys($files);
            }

            return Response::text(json_encode($packet, JSON_THROW_ON_ERROR));
        }
        $file = $files[$input['file']] ?? null;
        if ($file === null) {
            return Response::error('Unknown file. Read the handoff index first.');
        }
        $binary = is_object($file);
        $contents = $binary ? $file->base64 : $file;
        $offset = (int) ($input['offset'] ?? 0);
        $chunk = mb_substr($contents, $offset, 16000);
        $end = $offset + mb_strlen($chunk);

        return Response::text(json_encode(['encoding' => $binary ? 'base64' : 'text', 'content' => $chunk, 'nextOffset' => $end < mb_strlen($contents) ? $end : null], JSON_THROW_ON_ERROR));
    }
}
