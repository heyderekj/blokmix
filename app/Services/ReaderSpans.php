<?php

namespace App\Services;

use Normalizer;

/**
 * The reader never writes: every free string in a read must be a span of what was typed. This is
 * resources/js/core/reader/verbatim.ts in PHP (both run tests/fixtures/reader-spans.json): a span is found ignoring
 * case, curly versus straight quotes, dash kinds, runs of spaces and the punctuation at its ends, and comes back as
 * the slice of the original text.
 */
class ReaderSpans
{
    public const MAX_SPAN = 300;

    private const QUOTES = ['‘' => "'", '’' => "'", '‛' => "'", '`' => "'", '´' => "'", '“' => '"', '”' => '"', '„' => '"', '‟' => '"', '–' => '-', '—' => '-', '‐' => '-', '‑' => '-', '−' => '-'];

    private const EDGE = '/^[\s.,;:!?\'"‘’“”«»()\[\]…–—-]+|[\s.,;:!?\'"‘’“”«»()\[\]…–—-]+$/u';

    /** @return array{0: list<string>, 1: list<int>} folded characters, and each one's index in the original's characters */
    private static function fold(array $chars): array
    {
        $s = [];
        $at = [];
        foreach ($chars as $i => $ch) {
            if (preg_match('/^[\s\p{Z}\x{FEFF}]$/u', $ch)) {
                if ($s && end($s) !== ' ') {
                    $s[] = ' ';
                    $at[] = $i;
                }

                continue;
            }
            $f = mb_strtolower((string) Normalizer::normalize(self::QUOTES[$ch] ?? $ch, Normalizer::FORM_KC));
            foreach (mb_str_split($f) as $c) {
                $s[] = $c;
                $at[] = $i;
            }
        }

        return [$s, $at];
    }

    /** The part of $text that $span quotes, exactly as written, or null. */
    public static function find(string $text, mixed $span): ?string
    {
        if (! is_string($span)) {
            return null;
        }
        [$needle] = self::fold(mb_str_split((string) preg_replace(self::EDGE, '', $span)));
        $needle = trim(implode('', $needle));
        $len = mb_strlen($needle);
        if ($len === 0 || $len > self::MAX_SPAN) {
            return null;
        }
        $chars = mb_str_split($text);
        [$hay, $at] = self::fold($chars);
        $k = mb_strpos(implode('', $hay), $needle);
        if ($k === false) {
            return null;
        }
        $start = $at[$k];
        $end = $at[$k + $len - 1];

        return implode('', array_slice($chars, $start, $end - $start + 1));
    }

    /**
     * The read with every span replaced by the words exactly as typed, or null when any string at a span path
     * ("name", "feel.words[]", "pages[].purpose") isn't a span of $text. Nulls stand for what wasn't said.
     */
    public static function verbatim(array $read, string $text, array $paths): ?array
    {
        foreach ($paths as $path) {
            $ok = self::walk($read, explode('.', $path), $text);
            if (! $ok) {
                return null;
            }
        }

        return $read;
    }

    private static function walk(mixed &$node, array $parts, string $text): bool
    {
        if ($parts === []) {
            if ($node === null) {
                return true;
            }
            $exact = self::find($text, $node);
            if ($exact === null) {
                return false;
            }
            $node = $exact;

            return true;
        }
        $part = array_shift($parts);
        $many = str_ends_with($part, '[]');
        $key = $many ? substr($part, 0, -2) : $part;
        if (! is_array($node) || ! array_key_exists($key, $node)) {
            return true;
        }
        if (! $many) {
            return self::walk($node[$key], $parts, $text);
        }
        if (! is_array($node[$key])) {
            return true;
        }
        foreach ($node[$key] as &$item) {
            if (! self::walk($item, $parts, $text)) {
                return false;
            }
        }

        return true;
    }
}
