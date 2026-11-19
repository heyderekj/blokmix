<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Reader;
use App\Services\ReaderSpans;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Opis\JsonSchema\Validator;

/**
 * The reader (Claude, Anthropic) through the server. Unlike Jev's pass-through, this server owns the instructions and
 * the schema (resources/reader/<task>.json, built by scripts/read/build.ts): the browser sends only {task, text,
 * context}, so an account can't use it as a general model. The reply must match the schema and every string must be a
 * span of the text, or it's a 502 and the board keeps what keywords and Jev said. Logs counts and timings, never words.
 */
class ReadController extends Controller
{
    public const TASKS = ['start', 'need'];

    public function status(): JsonResponse
    {
        return response()->json(['on' => $this->key() !== '']);
    }

    public function read(Request $request, Reader $reader): JsonResponse
    {
        abort_if($this->key() === '', 503, 'Reading is off: the server has no Anthropic key (ANTHROPIC_API_KEY).');

        $body = json_decode($request->getContent(), false);
        abort_unless($body instanceof \stdClass, 422, 'Send the request as JSON.');
        $task = $body->task ?? null;
        if (! is_string($task) || ! in_array($task, self::TASKS, true)) {
            return response()->json(['message' => 'Ask for start or need.'], 422);
        }
        $spec = self::spec($task);
        $text = $body->text ?? null;
        if (! is_string($text) || trim($text) === '') {
            return response()->json(['message' => 'Send the text to read.'], 422);
        }
        if (mb_strlen($text) > $spec['max_chars']) {
            return response()->json(['message' => 'That’s too much to read at once.'], 422);
        }
        $context = $body->context ?? new \stdClass;
        if (is_array($context) && $context === []) {
            $context = new \stdClass;
        }
        if (! (new Validator)->validate($context, json_decode(json_encode($spec['context'])))->isValid()) {
            return response()->json(['message' => 'The context is Blokmix’s own ids only.'], 422);
        }
        if (! $this->underSiteCap()) {
            return response()->json(['message' => 'Reading is resting for today.'], 429);
        }

        $user = strtr($spec['user'], ['{context}' => json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), '{text}' => $text]);
        $started = microtime(true);
        $reply = $reader->read($spec, $user);
        $read = $reply ? $this->check($task, $spec, $reply['json'], $text) : null;
        $ms = (int) round((microtime(true) - $started) * 1000);

        Log::info('read', [
            'user' => $request->user()?->id,
            'task' => $task,
            'ok' => $read !== null,
            'answered' => $reply !== null,
            'ms' => $ms,
            'chars' => mb_strlen($text),
            'input_tokens' => $reply['input_tokens'] ?? null,
            'output_tokens' => $reply['output_tokens'] ?? null,
        ]);

        if ($read === null) {
            return response()->json(['message' => 'No reading that time.'], 502);
        }

        return response()->json([
            'read' => $read,
            'usage' => ['input_tokens' => $reply['input_tokens'], 'output_tokens' => $reply['output_tokens']],
            'ms' => $ms,
        ]);
    }

    /** The reply as a read: the schema, then every span (your exact words back), else null. */
    private function check(string $task, array $spec, string $json, string $text): ?array
    {
        $data = json_decode($json, false);
        if (! (new Validator)->validate($data, json_decode(json_encode($spec['schema'])))->isValid()) {
            return null;
        }

        return ReaderSpans::verbatim(json_decode($json, true), $text, $spec['spans']);
    }

    /** A task's instructions, schema and limits, as scripts/read/build.ts wrote them. */
    public static function spec(string $task): array
    {
        static $specs = [];

        return $specs[$task] ??= json_decode(file_get_contents(resource_path("reader/$task.json")), true, flags: JSON_THROW_ON_ERROR);
    }

    /** Counts this read against the site-wide daily cap (a guardrail for the bill, never shown as a feature). */
    private function underSiteCap(): bool
    {
        $key = 'read:site:'.now()->toDateString();
        Cache::add($key, 0, now()->endOfDay());

        return Cache::increment($key) <= (int) config('blokmix.read_daily_cap');
    }

    private function key(): string
    {
        return (string) config('blokmix.read_key');
    }
}
