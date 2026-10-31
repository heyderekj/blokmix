<?php

namespace App\Http\Controllers;

use App\Services\MixPacks;
use App\Services\PolarClient;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/** Buying a mix pack (Polar's checkout), receipts (Polar's portal) and Polar's webhooks. */
class BillingController extends Controller
{
    public function checkout(Request $request, MixPacks $packs): SymfonyResponse
    {
        abort_unless($packs->available(), 404);
        try {
            return Inertia::location($packs->checkoutUrl($request->user()));
        } catch (RuntimeException $e) {
            return back()->withErrors(['buy' => $e->getMessage()]);
        }
    }

    public function receipts(Request $request, MixPacks $packs): SymfonyResponse
    {
        abort_unless($packs->available(), 404);
        $url = $packs->receiptsUrl($request->user());
        abort_unless($url, 404);

        return Inertia::location($url);
    }

    public function webhook(Request $request, PolarClient $polar, MixPacks $packs): Response
    {
        $event = $polar->verifyWebhook($request);
        if ($event === null) {
            return response('Invalid signature', 401);
        }
        $packs->handle($event);

        return response('', 202);
    }
}
