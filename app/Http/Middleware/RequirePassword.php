<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps the app private until there are accounts: one shared password
 * (BLOKMIX_PASSWORD), entered once on /unlock and remembered for the session.
 * Closed in production when no password is set, so a fresh deploy never opens
 * to the world by accident.
 */
class RequirePassword
{
    public const SESSION_KEY = 'blokmix.unlocked';

    public function handle(Request $request, Closure $next): Response
    {
        $password = (string) config('blokmix.password');

        if ($password === '') {
            abort_if(app()->isProduction(), 503, 'Blokmix is closed until BLOKMIX_PASSWORD is set.');

            return $next($request);
        }

        if ($request->routeIs('unlock', 'unlock.attempt') || hash_equals(self::fingerprint($password), (string) $request->session()->get(self::SESSION_KEY))) {
            return $next($request);
        }

        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json(['message' => 'Blokmix is private. Unlock it first.'], 401);
        }

        return redirect()->guest(route('unlock'));
    }

    /** What the session remembers: changing the password signs everyone out. */
    public static function fingerprint(string $password): string
    {
        return hash_hmac('sha256', $password, (string) config('app.key'));
    }
}
