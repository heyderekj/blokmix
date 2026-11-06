<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // The people who run Blokmix (config blokmix.owners): they see the waitlist.
        Gate::define('run-blokmix', fn (User $user) => in_array(strtolower($user->email), config('blokmix.owners'), true));

        // Jev is asked as you type (Say it), so it gets more room a minute than other calls, and a daily cap per person.
        RateLimiter::for('jev', fn (Request $request) => [
            Limit::perMinute(120)->by('jev-m:'.($request->user()?->id ?: $request->ip())),
            Limit::perDay(3000)->by('jev-d:'.($request->user()?->id ?: $request->ip())),
        ]);
    }
}
