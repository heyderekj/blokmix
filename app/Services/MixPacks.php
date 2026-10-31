<?php

namespace App\Services;

use App\Models\BillingOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/** Selling mix packs: a Polar checkout for one, and the webhooks that grant it (or take it back on a full refund). */
class MixPacks
{
    public const PRODUCT = 'mix_pack';

    public function __construct(private PolarClient $polar) {}

    /** Whether people can buy a pack here now. */
    public function available(): bool
    {
        return config('billing.enabled') && $this->polar->configured();
    }

    /** Polar's checkout page for one pack, for this person. */
    public function checkoutUrl(User $user): string
    {
        $session = $this->polar->createCheckout(
            productId: (string) $this->polar->productId(self::PRODUCT),
            externalCustomerId: (string) $user->id,
            successUrl: url('/').'?bought=1',
            returnUrl: url('/'),
            email: $user->email,
            metadata: ['user_id' => (string) $user->id, 'product' => self::PRODUCT],
        );

        return $session['url'];
    }

    /** Polar's customer portal (receipts) for someone who has bought a pack. */
    public function receiptsUrl(User $user): ?string
    {
        return $user->polar_customer_id ? $this->polar->customerPortalUrl((string) $user->id) : null;
    }

    /**
     * A verified Polar event. Anything that isn't an order for a mix pack, or names nobody we know, is ignored
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
        if ($orderId === '' || $product !== self::PRODUCT) {
            Log::warning('Polar order.paid ignored: unknown order or product', ['order' => $orderId]);

            return;
        }

        DB::transaction(function () use ($user, $data, $orderId, $product) {
            $order = BillingOrder::firstOrCreate(['polar_order_id' => $orderId], [
                'user_id' => $user->id,
                'product_key' => $product,
                'packs' => 1,
                'amount_cents' => (int) ($data['total_amount'] ?? $data['amount'] ?? 0),
            ]);
            // A redelivered webhook: this order already granted its pack.
            if (! $order->wasRecentlyCreated) {
                return;
            }
            $user->forceFill(['polar_customer_id' => $data['customer_id'] ?? $user->polar_customer_id])->save();
            $user->increment('mix_packs', $order->packs);
        });
    }

    /** A full refund takes the pack back; the mixes stay (only opening more is refused). @param  array<string, mixed>  $data */
    private function refunded(User $user, array $data): void
    {
        $order = BillingOrder::where('polar_order_id', (string) ($data['id'] ?? ''))->where('user_id', $user->id)->first();
        if (! $order || $order->refunded_at !== null || ($data['status'] ?? null) !== 'refunded') {
            return;
        }

        DB::transaction(function () use ($user, $order) {
            $order->forceFill(['refunded_at' => now()])->save();
            $user->forceFill(['mix_packs' => max(0, $user->mix_packs - $order->packs)])->save();
        });
    }
}
