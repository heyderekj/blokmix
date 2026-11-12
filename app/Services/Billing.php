<?php

namespace App\Services;

use App\Models\BillingOrder;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Selling sites: free to make, $30 a site when you ship it (docs/pricing.md). A Polar checkout pays for one mix, and the
 * webhooks mark it paid (or, on a full refund, unpaid again). Plus, the old one-time unlock, is no longer sold; its
 * orders are still recognized so a refund takes it back.
 */
class Billing
{
    public const SITE = 'site';

    public const PLUS = 'plus';

    public function __construct(private PolarClient $polar) {}

    /** Whether people can pay for sites here now. */
    public function available(): bool
    {
        return config('billing.enabled') && $this->polar->configured();
    }

    /** Polar's checkout page for paying for $mix, for this person. A mix that already ships can't be paid for again. */
    public function checkoutUrl(User $user, Mix $mix): string
    {
        if ($mix->isPaid()) {
            throw new \RuntimeException('This site is already paid for.');
        }
        if ($mix->ships()) {
            throw new \RuntimeException('This site already ships free: there’s nothing to pay.');
        }
        $session = $this->polar->createCheckout(
            productId: (string) $this->polar->productId(self::SITE),
            externalCustomerId: (string) $user->id,
            successUrl: url("/{$mix->short}").'?paid=1',
            returnUrl: url("/{$mix->short}"),
            email: $user->email,
            metadata: ['user_id' => (string) $user->id, 'mix_id' => (string) $mix->id, 'product' => self::SITE],
        );

        return $session['url'];
    }

    /** Polar's customer portal (receipts) for someone who has paid. */
    public function receiptsUrl(User $user): ?string
    {
        return $user->polar_customer_id ? $this->polar->customerPortalUrl((string) $user->id) : null;
    }

    /**
     * A verified Polar event. Anything that isn't an order for a site (or Plus), or names nobody we know, is ignored
     * (so Polar doesn't retry it).
     *
     * @param  array<string, mixed>  $event
     */
    public function handle(array $event): void
    {
        $type = (string) ($event['type'] ?? '');
        $data = is_array($event['data'] ?? null) ? $event['data'] : [];
        $user = $this->userFrom($data);
        if (! $user) {
            Log::log($type === 'order.paid' ? 'warning' : 'info', 'Polar webhook ignored: no matching account', ['type' => $type, 'id' => $data['id'] ?? null]);

            return;
        }

        match ($type) {
            'order.paid' => $this->paid($user, $data),
            'order.refunded' => $this->refunded($user, $data),
            default => null,
        };
    }

    /** @param  array<string, mixed>  $data */
    private function userFrom(array $data): ?User
    {
        $id = $data['customer']['external_id'] ?? $data['metadata']['user_id'] ?? null;
        if (is_string($id) && ctype_digit($id)) {
            return User::find((int) $id);
        }
        $customer = $data['customer_id'] ?? $data['customer']['id'] ?? null;

        return is_string($customer) && $customer !== '' ? User::where('polar_customer_id', $customer)->first() : null;
    }

    /** @param  array<string, mixed>  $data */
    private function paid(User $user, array $data): void
    {
        $orderId = (string) ($data['id'] ?? '');
        $product = $this->polar->productKey($data['product_id'] ?? $data['product']['id'] ?? null);
        if ($orderId === '' || ! in_array($product, [self::SITE, self::PLUS], true)) {
            Log::warning('Polar order.paid ignored: unknown order or product', ['order' => $orderId]);

            return;
        }
        $mixId = $data['metadata']['mix_id'] ?? null;
        $mix = $product === self::SITE && is_string($mixId) && $mixId !== '' ? Mix::find($mixId) : null;
        if ($product === self::SITE && ! $mix) {
            // Kept as a record (the money came in), but there's no mix to mark: refund it, or set it by hand.
            Log::warning('Polar order.paid for a site with no matching mix', ['order' => $orderId, 'mix' => $mixId]);
        }

        DB::transaction(function () use ($user, $data, $orderId, $product, $mix) {
            $order = BillingOrder::firstOrCreate(['polar_order_id' => $orderId], [
                'user_id' => $user->id,
                'mix_id' => $mix?->id,
                'product_key' => $product,
                'amount_cents' => (int) ($data['total_amount'] ?? $data['amount'] ?? 0),
            ]);
            // A redelivered webhook: this order already did its work.
            if (! $order->wasRecentlyCreated) {
                return;
            }
            $user->forceFill(['polar_customer_id' => $data['customer_id'] ?? $user->polar_customer_id])->save();
            if ($product === self::PLUS) {
                $user->forceFill(['plan' => 'plus'])->save();
            } elseif ($mix && ! $mix->isPaid()) {
                // Straight to the row: a payment isn't an edit, so the mix's lock stays where it is.
                Mix::whereKey($mix->id)->update(['paid_at' => now(), 'paid_order_id' => $order->id]);
            }
        });
    }

    /**
     * A full refund un-pays the site (or takes Plus back), unless another order still holds it. Nothing is taken away:
     * the mix, its versions and anything already downloaded stay; only exporting again asks to pay.
     *
     * @param  array<string, mixed>  $data
     */
    private function refunded(User $user, array $data): void
    {
        $order = BillingOrder::where('polar_order_id', (string) ($data['id'] ?? ''))->where('user_id', $user->id)->first();
        if (! $order || $order->refunded_at !== null || ($data['status'] ?? null) !== 'refunded') {
            return;
        }

        DB::transaction(function () use ($user, $order) {
            $order->forceFill(['refunded_at' => now()])->save();
            $held = BillingOrder::whereNull('refunded_at')->where('product_key', $order->product_key);
            if ($order->product_key === self::PLUS) {
                if (! (clone $held)->where('user_id', $user->id)->exists()) {
                    $user->forceFill(['plan' => 'free'])->save();
                }

                return;
            }
            if ($order->mix_id === null) {
                return;
            }
            // Another payment for the same site (two people paid) keeps it paid.
            $other = (clone $held)->where('mix_id', $order->mix_id)->oldest('id')->first();
            Mix::whereKey($order->mix_id)->where('paid_order_id', $order->id)->update($other
                ? ['paid_order_id' => $other->id]
                : ['paid_at' => null, 'paid_order_id' => null]);
        });
    }
}
