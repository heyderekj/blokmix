<?php

use App\Http\Middleware\HandleInertiaRequests;
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
        ]);
        $middleware->redirectGuestsTo(fn () => route('login'));
        // Laravel Cloud terminates HTTPS in front of the app.
        $middleware->trustProxies(at: '*');
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
