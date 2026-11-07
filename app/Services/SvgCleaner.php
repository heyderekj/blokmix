<?php

namespace App\Services;

/**
 * SVG pictures and logos people add, cleaned before they're stored and served from the app's own address: no
 * scripts, event handlers, embedded documents, outside links, imports or outside url() references. The same rules
 * as the board's resources/js/core/svg.ts (the browser cleans first; this is the server not taking its word for it).
 */
class SvgCleaner
{
    private const DROP = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'handler', 'listener'];

    /** The cleaned SVG, or null when the text isn't an SVG. */
    public static function clean(string $text): ?string
    {
        if (! preg_match('/^\s*(<\?xml[^>]*\?>\s*)?(<!--.*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/is', $text)) {
            return null;
        }
        $s = preg_replace(['/<\?xml.*?\?>/is', '/<!DOCTYPE.*?>/is', '/<!--.*?-->/s'], '', $text);
        $s = preg_replace('/<!\[CDATA\[(.*?)\]\]>/s', '$1', $s);
        foreach (self::DROP as $tag) {
            $s = preg_replace(["/<{$tag}\\b.*?<\\/{$tag}\\s*>/is", "/<{$tag}\\b[^>]*\\/?>/i"], '', $s);
        }
        $s = preg_replace('/<(set|animate)\b[^>]*attributeName\s*=\s*["\']?\s*(on\w+|(xlink:)?href)\b[^>]*\/?>(<\/\1\s*>)?/i', '', $s);
        $s = preg_replace('/\s+on[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $s);
        $s = preg_replace_callback('/\s+((?:xlink:)?href)\s*=\s*("([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', function ($m) {
            $value = ($m[3] ?? '') . ($m[4] ?? '') . ($m[5] ?? '');

            return preg_match('/^\s*(#|data:image\/(png|jpe?g|gif|webp|avif);base64,)/i', $value) ? $m[0] : '';
        }, $s);
        $s = preg_replace('/@import[^;]*;?/i', '', $s);
        $s = preg_replace('/url\(\s*([\'"]?)(?!\s*#)[^)]*\1\s*\)/i', 'none', $s);
        $s = preg_replace('/(javascript|vbscript)\s*:/i', '', $s);

        return preg_match('/<svg\b/i', $s) ? trim($s) : null;
    }
}
