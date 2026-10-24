<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A plain `blokmix_signed_in=1` cookie while someone is signed in, gone when they
 * aren't. It carries nothing secret (the session stays HTTP-only and encrypted):
 * it only tells the edge in front of blokmix.com whether `/` should be the app or
 * the website, the way notion.com works.
 */
class MarkSignedIn
{
    public const COOKIE = 'blokmix_signed_in';

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $signedIn = $request->user() !== null;
        $has = $request->cookies->has(self::COOKIE);

        if ($signedIn && ! $has) {
            $response->headers->setCookie(cookie(self::COOKIE, '1', 60 * 24 * 400, null, config('session.domain'), null, false, false, 'lax'));
        } elseif (! $signedIn && $has) {
            $response->headers->setCookie(cookie()->forget(self::COOKIE, null, config('session.domain')));
        }

        return $response;
    }
}
