<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => fn () => $request->user()?->only('id', 'name', 'email'),
                // Whether this account runs Blokmix (the waitlist link shows for them).
                'owner' => fn () => (bool) $request->user()?->can('run-blokmix'),
                // The plan, what it includes and what's used, for the mixes page and the board.
                'plan' => fn () => $request->user() ? ['name' => $request->user()->planName(), 'limits' => $request->user()->limits(), 'usage' => $request->user()->usage()] : null,
            ],
            'flash' => fn () => $request->session()->get('flash'),
        ];
    }
}
