<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A plain `blokmix_signed_in=1` cookie that tells the public site when to check
 * for a session before showing My Mixes. Laravel's session determines access.
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
