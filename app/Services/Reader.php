<?php

namespace App\Services;

/**
 * The reader: turns what someone wrote into Blokmix's own picks (resources/reader/<task>.json holds the instructions
 * and the schema). AnthropicReader asks Claude; FakeReader answers in tests. Either returns null when there's no
 * usable answer (refused, cut off, timed out, failed), and the controller answers 502 so the board falls back.
 */
interface Reader
{
    /**
     * @param  array{system: string, schema: array<string, mixed>, max_tokens: int, effort: string}  $spec
     * @return array{json: string, input_tokens: int, output_tokens: int, why?: string}|null The reply's JSON text and
     *                                                                                       what it took, or null
     */
    public function read(array $spec, string $userTurn): ?array;
}
