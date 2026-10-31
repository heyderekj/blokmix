<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\MarkSignedIn;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            MarkSignedIn::class,
        ]);
        // The signed-in flag is read at the edge, so it isn't encrypted (it holds nothing but "1").
        $middleware->encryptCookies(except: [MarkSignedIn::COOKIE]);
        $middleware->redirectGuestsTo(fn () => route('login'));
        // Laravel Cloud terminates HTTPS in front of the app.
        $middleware->trustProxies(at: '*');
        // The website's waitlist form is static HTML on blokmix.com, so it has no CSRF token to send.
        // Polar's webhooks are signed instead.
        $middleware->validateCsrfTokens(except: ['api/waitlist', 'api/polar/webhook']);
        // A mix is saved exactly as the board sends it: words keep their spaces, and empty words stay empty.
        $saves = fn (Request $request) => $request->is('api/*');
        $middleware->trimStrings(except: [$saves]);
        $middleware->convertEmptyStringsToNull(except: [$saves]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
