<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Laravel\Fortify\Fortify;

/** Accounts: sign up and sign in with an email and password (Fortify), on Inertia pages. */
class FortifyServiceProvider extends ServiceProvider
{
    /** Reset links go out only when a real mail service is set; with the log mailer nobody would get them. */
    public static function mailWorks(): bool
    {
        return ! in_array(config('mail.default'), ['log', 'array'], true);
    }

    public function boot(): void
    {
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::loginView(fn () => Inertia::render('auth/login', ['canReset' => self::mailWorks()]));
        // Arriving from a share link: say which mix it opens.
        Fortify::registerView(fn () => Inertia::render('auth/register', ['invite' => session('invite')]));
        Fortify::requestPasswordResetLinkView(fn () => Inertia::render('auth/forgot-password', ['status' => session('status'), 'canReset' => self::mailWorks()]));
        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('auth/reset-password', [
            'token' => $request->route('token'),
            'email' => $request->string('email')->toString(),
        ]));

        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });
    }
}
