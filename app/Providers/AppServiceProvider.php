<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
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
    }
}
