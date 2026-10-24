<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RequirePassword;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // The password gate needs the session, so it runs after the web group's own middleware.
        $middleware->web(append: [
            RequirePassword::class,
            HandleInertiaRequests::class,
        ]);
        // …but before route bindings, so nothing (not even whether a mix exists) answers without it.
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: RequirePassword::class);
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
