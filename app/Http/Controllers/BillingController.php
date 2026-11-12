<?php

namespace App\Http\Controllers;

use App\Models\Mix;
use App\Services\Billing;
use App\Services\PolarClient;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/** Paying for a site (Polar's checkout), receipts (Polar's portal) and Polar's webhooks. */
class BillingController extends Controller
{
    /** Anyone who can edit a mix may pay for it. */
    public function checkout(Request $request, Mix $mix, Billing $billing): SymfonyResponse
    {
        $role = $mix->roleOf($request->user());
        abort_unless($role, 404);
        abort_unless($role->canEdit(), 403, 'Only people who can edit this mix can pay for it.');
        abort_unless($billing->available(), 404);
        try {
            return Inertia::location($billing->checkoutUrl($request->user(), $mix));
        } catch (RuntimeException $e) {
            return back()->withErrors(['buy' => $e->getMessage()]);
        }
    }

    public function receipts(Request $request, Billing $billing): SymfonyResponse
    {
        abort_unless($billing->available(), 404);
        $url = $billing->receiptsUrl($request->user());
        abort_unless($url, 404);

        return Inertia::location($url);
    }

    public function webhook(Request $request, PolarClient $polar, Billing $billing): Response
    {
        $event = $polar->verifyWebhook($request);
        if ($event === null) {
            return response('Invalid signature', 401);
        }
        $billing->handle($event);

        return response('', 202);
    }
}
