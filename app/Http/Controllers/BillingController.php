<?php

namespace App\Http\Controllers;

use App\Services\Plus;
use App\Services\PolarClient;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/** Buying Plus (Polar's checkout), receipts (Polar's portal) and Polar's webhooks. */
class BillingController extends Controller
{
    public function checkout(Request $request, Plus $plus): SymfonyResponse
    {
        abort_unless($plus->available(), 404);
        try {
            return Inertia::location($plus->checkoutUrl($request->user()));
        } catch (RuntimeException $e) {
            return back()->withErrors(['buy' => $e->getMessage()]);
        }
    }

    public function receipts(Request $request, Plus $plus): SymfonyResponse
    {
        abort_unless($plus->available(), 404);
        $url = $plus->receiptsUrl($request->user());
        abort_unless($url, 404);

        return Inertia::location($url);
    }

    public function webhook(Request $request, PolarClient $polar, Plus $plus): Response
    {
        $event = $polar->verifyWebhook($request);
        if ($event === null) {
            return response('Invalid signature', 401);
        }
        $plus->handle($event);

        return response('', 202);
    }
}
