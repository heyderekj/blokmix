<?php

namespace App\Http\Controllers;

use App\Http\Middleware\RequirePassword;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** The shared-password page that stands in for accounts until 4d. */
class UnlockController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('unlock');
    }

    public function attempt(Request $request): RedirectResponse
    {
        $request->validate(['password' => ['required', 'string']]);
        $password = (string) config('blokmix.password');

        if ($password === '' || ! hash_equals($password, (string) $request->input('password'))) {
            throw ValidationException::withMessages(['password' => 'That’s not it.']);
        }

        $request->session()->regenerate();
        $request->session()->put(RequirePassword::SESSION_KEY, RequirePassword::fingerprint($password));

        return redirect()->intended(route('mixes.index'));
    }
}
