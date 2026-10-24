<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps the app private until there are accounts: HTTP Basic auth against one
 * shared password (any user name). Closed in production when no password is set,
 * so a fresh deploy never opens to the world by accident.
 */
class RequirePassword
{
    public function handle(Request $request, Closure $next): Response
    {
        $password = (string) config('blokmix.password');

        if ($password === '') {
            abort_if(app()->isProduction(), 503, 'Blokmix is closed until BLOKMIX_PASSWORD is set.');

            return $next($request);
        }

        if (! hash_equals($password, (string) $request->getPassword())) {
            return response('Blokmix is private.', 401, ['WWW-Authenticate' => 'Basic realm="Blokmix", charset="UTF-8"']);
        }

        return $next($request);
    }
}
