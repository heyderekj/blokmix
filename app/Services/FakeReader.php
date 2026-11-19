<?php

namespace App\Services;

use Closure;

/**
 * The reader in tests: a closure gets the spec and the user turn and returns what the model "said" (an array becomes
 * its JSON; a string is sent as is, to test bad replies; null is no answer). No network, ever.
 */
class FakeReader implements Reader
{
    /** @var list<array{spec: array, user: string}> */
    public array $calls = [];

    public function __construct(private Closure $answer) {}

    public function read(array $spec, string $userTurn): ?array
    {
        $this->calls[] = ['spec' => $spec, 'user' => $userTurn];
        $said = ($this->answer)($spec, $userTurn);
        if ($said === null) {
            return null;
        }

        return ['json' => is_string($said) ? $said : json_encode($said, JSON_UNESCAPED_UNICODE), 'input_tokens' => 2800, 'output_tokens' => 300];
    }
}
