<?php

namespace App\Http\Controllers;

use App\Models\Publication;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * blok.page: published mixes at /<code>/<slug>/<page>, read from published/<code>/ on the uploads disk. These routes
 * run without the web middleware (no session, no cookies, no CSRF), and every answer says noindex: a published mix is
 * an unlisted snapshot to share, not a site for search engines.
 */
class PublishedController extends Controller
{
    private const TYPES = [
        'html' => 'text/html; charset=utf-8', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'gif' => 'image/gif', 'avif' => 'image/avif', 'mp4' => 'video/mp4',
        'webm' => 'video/webm', 'mov' => 'video/quicktime', 'json' => 'application/json', 'lottie' => 'application/zip',
    ];

    /** The Content-Type a published file is served (and stored) with. */
    public static function typeOf(string $path): string
    {
        return self::TYPES[strtolower(pathinfo($path, PATHINFO_EXTENSION))] ?? 'application/octet-stream';
    }

    public function home(): Response
    {
        return $this->plain(redirect()->away(config('blokmix.home_url')));
    }

    public function show(Request $request, string $code, string $rest = ''): Response
    {
        $publication = Publication::where('code', $code)->first();
        if (! $publication) {
            return $this->notice(404, 'Nothing is published here.');
        }
        if (! $publication->isLive()) {
            return $this->notice(410, 'This mix isn’t published anymore.');
        }

        $parts = $rest === '' ? [] : explode('/', $rest, 2);
        $slug = $parts[0] ?? '';
        $path = $parts[1] ?? '';
        // The name is decoration: an old or missing one goes to today's, and the folder always ends in a slash so
        // the pages' relative links resolve.
        if ($slug !== $publication->slug) {
            return $this->plain(redirect("/{$code}/{$publication->slug}/".($slug === '' ? '' : $path), 301));
        }
        $file = $this->fileFor($path);
        if ($file === null) {
            return $this->notice(404, 'There’s no such page in this mix.');
        }
        $disk = Storage::disk(config('blokmix.uploads_disk'));
        $stored = $publication->dir().'/'.$file;
        if (! $disk->exists($stored)) {
            return $this->notice(404, 'There’s no such page in this mix.');
        }

        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $etag = '"'.md5($publication->published_at?->getTimestamp().'|'.$file).'"';
        if (in_array($etag, $request->getETags(), true)) {
            return $this->plain(response('', 304)->setEtag(trim($etag, '"')), $ext);
        }
        $response = response($disk->get($stored), 200, ['Content-Type' => self::TYPES[$ext] ?? 'application/octet-stream']);
        $response->setEtag(trim($etag, '"'));

        return $this->plain($response, $ext);
    }

    /** `` → index.html, `about` (or `about/`) → about.html, `media/…` as is. Null for anything else. */
    private function fileFor(string $path): ?string
    {
        $path = trim($path, '/');
        if ($path === '' || $path === 'index' || $path === 'index.html') {
            return 'index.html';
        }
        if (str_starts_with($path, 'media/')) {
            return \App\Http\Controllers\Api\PublicationController::safePath($path) ? $path : null;
        }
        $page = str_ends_with($path, '.html') ? $path : $path.'.html';

        return \App\Http\Controllers\Api\PublicationController::safePath($page) ? $page : null;
    }

    private function notice(int $status, string $message): Response
    {
        $html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            .'<meta name="robots" content="noindex, nofollow"><title>blok.page</title></head>'
            .'<body style="font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;color:#222">'
            .'<p>'.e($message).' <a href="'.e(config('blokmix.home_url')).'" style="color:inherit">Blokmix</a></p></body></html>';

        return $this->plain(response($html, $status, ['Content-Type' => 'text/html; charset=utf-8']), 'html');
    }

    /** What every blok.page answer carries: noindex, a tight CSP on pages, and caching that lets a republish show quickly. */
    private function plain(Response $response, string $ext = ''): Response
    {
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        if ($ext === 'html' || $ext === 'svg') {
            $app = rtrim((string) config('blokmix.home_url'), '/');
            $response->headers->set('Content-Security-Policy', implode('; ', [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
                "style-src 'self' 'unsafe-inline' https:",
                "font-src 'self' data: https:",
                "img-src 'self' data: blob: https:",
                "media-src 'self' blob: https:",
                "connect-src 'self' https:",
                'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com',
                "worker-src 'self' blob:",
                "form-action 'none'",
                "base-uri 'none'",
                "frame-ancestors 'self' {$app}",
            ]));
        }
        if ($ext !== '' && $response->getStatusCode() < 300 || $response->getStatusCode() === 304) {
            $response->headers->set('Cache-Control', $ext === 'html' ? 'public, max-age=60, must-revalidate' : 'public, max-age=3600');
        }

        return $response;
    }
}
