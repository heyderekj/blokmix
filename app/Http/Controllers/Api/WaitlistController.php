<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * blokmix.com's waitlist: the website's form posts here through the edge (it's under /api). No session or CSRF
 * token, since the site is static; a hidden field nobody sees catches simple bots, and the route is throttled.
 * Joining twice is fine and says the same thing.
 */
class WaitlistController extends Controller
{
    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);
        $input = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:254'],
            'source' => ['nullable', 'string', 'max:40'],
            'website' => ['nullable', 'string'],
        ]);

        if (blank($input['website'] ?? null)) {
            DB::table('waitlist')->insertOrIgnore([
                'email' => $input['email'],
                'source' => $input['source'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $request->expectsJson()
            ? response()->json(['joined' => true])
            : redirect('/?joined=1#waitlist');
    }
}
