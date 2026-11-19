<?php

namespace App\Providers;

use App\Models\User;
use App\Services\AnthropicReader;
use App\Services\Reader;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // The reader asks Claude; tests swap in App\Services\FakeReader.
        $this->app->bind(Reader::class, fn () => new AnthropicReader(
            (string) config('blokmix.read_key'),
            (string) config('blokmix.read_model'),
            (float) config('blokmix.read_timeout'),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Laravel Cloud receives the Worker's requests on its upstream hostname.
        if ($this->app->isProduction()) {
            URL::useOrigin(config('blokmix.home_url'));
        }

        \Laravel\Passport\Passport::authorizationView('mcp::authorize');

        // The people who run Blokmix (config blokmix.owners): they see the waitlist.
        Gate::define('run-blokmix', fn (User $user) => in_array(strtolower($user->email), config('blokmix.owners'), true));

        // Jev is asked as you type (Say it), so it gets more room a minute than other calls, and a daily cap per person.
        RateLimiter::for('jev', fn (Request $request) => [
            Limit::perMinute(120)->by('jev-m:'.($request->user()?->id ?: $request->ip())),
            Limit::perDay(3000)->by('jev-d:'.($request->user()?->id ?: $request->ip())),
        ]);

        // The reader runs when you finish a sentence or paste, never as you type: a few a minute, a couple hundred a day.
        RateLimiter::for('read', fn (Request $request) => [
            Limit::perMinute(20)->by('read-m:'.($request->user()?->id ?: $request->ip())),
            Limit::perDay(200)->by('read-d:'.($request->user()?->id ?: $request->ip())),
        ]);
    }
}
