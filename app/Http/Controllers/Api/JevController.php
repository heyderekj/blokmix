<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Models\LibrarySection;

/**
 * Jev (TypeSafe's System One model) through the server, so its key never reaches the browser. The board builds the
 * questions (resources/js/core/jev); this checks the request is the shape and size Blokmix sends, then passes the
 * body on exactly as it came (PHP would turn an empty {} into [], which TypeSafe reads differently). Logs counts and
 * timings, never words or pictures.
 */
class JevController extends Controller
{
    /** The limits Blokmix's own requests stay inside (scripts/jev/devProxy.ts checks the same). */
    public const MAX_BODY = 6 * 1024 * 1024;

    public const MAX_JSON_WITHOUT_IMAGES = 200 * 1024;

    public const MAX_QUESTIONS = 200;

    public const MAX_IMAGES = 20;

    public const MAX_IMAGE_BYTES = 1024 * 1024;

    public const MODELS = ['jev-latest', 'jev-preview'];

    public const QUESTION_TYPES = ['choice', 'score', 'noul', 'box'];

    /**
     * Count something people asked for that Blokmix can't do yet, by its name only (a menu, opening hours…). The board
     * names it with Jev from a closed list; nothing else about the ask is kept.
     */
    public function want(Request $request): Response
    {
        $input = $request->validate([
            'want' => ['required', 'string', 'regex:/^[a-z0-9-]{2,32}$/'],
            'feature' => ['required', Rule::in(['say', 'pour', 'dress'])],
            'section_type' => ['nullable', Rule::in(LibrarySection::TYPES)],
            'kind' => ['nullable', Rule::in(['product', 'studio', 'local', 'event', 'personal', 'writing'])],
        ]);
        DB::table('jev_wants')->insert([...$input, 'created_at' => now()]);

        return response()->noContent();
    }

    /** What people asked for in the last 90 days, most first, with where they asked (for /library/admin). */
    public static function wantCounts(int $days = 90): array
    {
        $rows = DB::table('jev_wants')->where('created_at', '>=', now()->subDays($days))
            ->select('want', 'feature', DB::raw('count(*) as n'))->groupBy('want', 'feature')->get();

        return $rows->groupBy('want')
            ->map(fn ($g, $want) => ['want' => $want, 'count' => (int) $g->sum('n'), 'from' => $g->mapWithKeys(fn ($r) => [$r->feature => (int) $r->n])->all()])
            ->sortByDesc('count')->values()->take(40)->all();
    }

    public function status(): JsonResponse
    {
        return response()->json(['on' => $this->key() !== '']);
    }

    public function ask(Request $request): JsonResponse|Response
    {
        $key = $this->key();
        abort_if($key === '', 503, 'Jev is off: the server has no TypeSafe key (TYPESAFE_API_KEY).');

        $raw = $request->getContent();
        abort_if(strlen($raw) > self::MAX_BODY, 413, 'That is more than Jev is asked about at once.');
        $body = json_decode($raw, true);
        abort_unless(is_array($body), 422, 'Send the request as JSON.');

        $problem = $this->problem($body, $raw);
        if ($problem !== null) {
            return response()->json(['message' => $problem], 422);
        }

        $images = ! empty($body['assets']) || collect($body['questions'])->contains(fn ($q) => ($q['type'] ?? null) === 'box');
        $started = microtime(true);
        $res = Http::withToken($key)
            ->withHeaders($images ? ['TypeSafe-Danger-Zone-Images' => 'true'] : [])
            ->acceptJson()
            ->timeout($images ? 20 : 10)
            ->withBody($raw, 'application/json')
            ->post('https://api.typesafe.ai/v1/systemone');

        Log::info('jev', [
            'user' => $request->user()?->id,
            'status' => $res->status(),
            'ms' => (int) round((microtime(true) - $started) * 1000),
            'questions' => count($body['questions']),
            'images' => count($body['assets'] ?? []),
            'input_tokens' => $res->json('usage.input_tokens'),
        ]);

        return response($res->body(), $res->status(), ['Content-Type' => 'application/json']);
    }

    /** What's wrong with a request, in a sentence, or null when it's one Blokmix would send. */
    private function problem(array $body, string $raw): ?string
    {
        if (! in_array($body['model'] ?? null, self::MODELS, true)) {
            return 'Ask jev-latest or jev-preview.';
        }
        if (! array_key_exists('state', $body)) {
            return 'Send a state.';
        }
        $questions = $body['questions'] ?? null;
        if (! is_array($questions) || $questions === [] || array_is_list($questions)) {
            return 'Send the questions by name.';
        }
        if (count($questions) > self::MAX_QUESTIONS) {
            return 'At most '.self::MAX_QUESTIONS.' questions at once.';
        }
        foreach ($questions as $q) {
            if (! is_array($q) || ! in_array($q['type'] ?? null, self::QUESTION_TYPES, true)) {
                return 'Every question is a choice, score, noul or box.';
            }
        }

        $assets = $body['assets'] ?? [];
        if (! is_array($assets)) {
            return 'Assets go by reference.';
        }
        if ($assets === [] && strlen($raw) > self::MAX_JSON_WITHOUT_IMAGES) {
            return 'That is more words than Jev is asked about at once.';
        }
        if (count($assets) > self::MAX_IMAGES) {
            return 'At most '.self::MAX_IMAGES.' pictures at once.';
        }
        foreach ($assets as $asset) {
            $bytes = is_array($asset) && ($asset['type'] ?? null) === 'image' && in_array($asset['format'] ?? null, ['jpg', 'jpeg', 'png'], true)
                ? base64_decode((string) ($asset['data_base64'] ?? ''), true)
                : false;
            if ($bytes === false || $bytes === '' || strlen($bytes) > self::MAX_IMAGE_BYTES) {
                return 'Pictures are JPEG or PNG, under 1 MB each.';
            }
            $size = @getimagesizefromstring($bytes);
            if (! $size || ! in_array($size[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
                return 'Pictures are JPEG or PNG, under 1 MB each.';
            }
            [$w, $h] = $size;
            if ($w < 280 || $h < 280 || $w > 1568 || $h > 1568) {
                return 'Pictures are 280 to 1568 pixels a side.';
            }
        }

        return null;
    }

    private function key(): string
    {
        return (string) config('blokmix.jev_key');
    }
}
