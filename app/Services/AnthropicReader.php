<?php

namespace App\Services;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\RateLimitException;
use GuzzleHttp\Client as Guzzle;
use Illuminate\Support\Facades\Log;

/**
 * The reader through Anthropic's PHP SDK: one Messages call with structured output against the task's schema, a short
 * timeout and at most one retry. Logs why a read failed, never the words.
 */
class AnthropicReader implements Reader
{
    public function __construct(private string $key, private string $model, private float $timeout = 12.0) {}

    public function read(array $spec, string $userTurn): ?array
    {
        $client = new Client(
            apiKey: $this->key,
            requestOptions: [
                'maxRetries' => 1,
                'timeout' => $this->timeout,
                // The SDK leaves the timeout to the transport: Guzzle enforces it.
                'transporter' => new Guzzle(['timeout' => $this->timeout, 'connect_timeout' => 3]),
            ],
        );

        try {
            $message = $client->messages->create(
                model: $this->model,
                maxTokens: $spec['max_tokens'],
                system: [['type' => 'text', 'text' => $spec['system'], 'cacheControl' => ['type' => 'ephemeral']]],
                messages: [['role' => 'user', 'content' => $userTurn]],
                outputConfig: ['effort' => $spec['effort'], 'format' => ['type' => 'json_schema', 'schema' => $spec['schema']]],
            );
        } catch (RateLimitException) {
            return $this->fail('rate_limited');
        } catch (APIStatusException $e) {
            return $this->fail('status_'.$e->status);
        } catch (APIConnectionException) {
            return $this->fail('connection');
        }

        // A refusal or a reply cut off at max_tokens may not match the schema: no read.
        if ($message->stopReason !== 'end_turn') {
            return $this->fail('stop_'.($message->stopReason ?? 'none'));
        }
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                return [
                    'json' => $block->text,
                    'input_tokens' => $message->usage->inputTokens + (int) $message->usage->cacheReadInputTokens + (int) $message->usage->cacheCreationInputTokens,
                    'output_tokens' => $message->usage->outputTokens,
                ];
            }
        }

        return $this->fail('no_text');
    }

    private function fail(string $why): null
    {
        Log::warning('read failed', ['why' => $why]);

        return null;
    }
}
