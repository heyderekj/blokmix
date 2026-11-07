<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Plus bought at Polar: a signed webhook grants it once, a full refund takes it back. */
class BillingTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'whsec_'.'dGVzdC1zZWNyZXQtZm9yLWJsb2ttaXg=';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'billing.enabled' => true,
            'billing.polar.access_token' => 'test-token',
            'billing.polar.webhook_secret' => self::SECRET,
            'billing.polar.products.plus' => 'prod_plus',
        ]);
    }

    private function deliver(array $event, ?string $secret = null): \Illuminate\Testing\TestResponse
    {
        $body = json_encode($event);
        $id = 'msg_'.md5($body);
        $ts = (string) time();
        $key = base64_decode(substr($secret ?? self::SECRET, 6));
        $sig = base64_encode(hash_hmac('sha256', "{$id}.{$ts}.{$body}", $key, true));

        return $this->call('POST', '/api/polar/webhook', [], [], [], [
            'HTTP_WEBHOOK_ID' => $id, 'HTTP_WEBHOOK_TIMESTAMP' => $ts, 'HTTP_WEBHOOK_SIGNATURE' => "v1,{$sig}",
            'CONTENT_TYPE' => 'application/json',
        ], $body);
    }

    private function order(User $user, string $id = 'ord_1', array $more = []): array
    {
        return ['type' => 'order.paid', 'data' => [
            'id' => $id, 'product_id' => 'prod_plus', 'customer_id' => 'cus_1', 'total_amount' => 2500,
            'customer' => ['id' => 'cus_1', 'external_id' => (string) $user->id], ...$more,
        ]];
    }

    public function test_a_paid_order_grants_plus_once(): void
    {
        $me = User::factory()->create();
        $this->deliver($this->order($me))->assertStatus(202);
        $this->deliver($this->order($me))->assertStatus(202);
        $this->assertSame('plus', $me->fresh()->plan);
        $this->assertSame(1, $me->billingOrders()->count());
        $this->assertSame('cus_1', $me->fresh()->polar_customer_id);
        $this->assertNull($me->fresh()->mixSlots());
    }

    public function test_someone_with_plus_cant_buy_it_again(): void
    {
        $me = User::factory()->create();
        $me->forceFill(['plan' => 'plus'])->save();
        $this->actingAs($me)->post('/api/billing/checkout')->assertSessionHasErrors('buy');
    }

    public function test_a_bad_signature_grants_nothing(): void
    {
        $me = User::factory()->create();
        $this->deliver($this->order($me), 'whsec_'.base64_encode('someone-else'))->assertStatus(401);
        $this->assertSame('free', $me->fresh()->plan);
    }

    public function test_other_products_and_strangers_are_ignored(): void
    {
        $me = User::factory()->create();
        $this->deliver(['type' => 'order.paid', 'data' => ['id' => 'ord_x', 'product_id' => 'prod_other', 'customer' => ['external_id' => (string) $me->id]]])->assertStatus(202);
        $this->deliver(['type' => 'order.paid', 'data' => ['id' => 'ord_y', 'product_id' => 'prod_plus', 'customer' => ['external_id' => '99999']]])->assertStatus(202);
        $this->assertSame('free', $me->fresh()->plan);
    }

    public function test_a_full_refund_takes_plus_back_and_keeps_the_mixes(): void
    {
        $me = User::factory()->create();
        $this->deliver($this->order($me))->assertStatus(202);
        $me->refresh();
        foreach (['One', 'Two'] as $name) {
            $this->actingAs($me)->postJson('/api/mixes', ['name' => $name])->assertCreated();
        }

        $this->deliver(['type' => 'order.refunded', 'data' => ['id' => 'ord_1', 'status' => 'partially_refunded', 'customer' => ['external_id' => (string) $me->id]]]);
        $this->assertSame('plus', $me->fresh()->plan);
        $this->deliver(['type' => 'order.refunded', 'data' => ['id' => 'ord_1', 'status' => 'refunded', 'customer' => ['external_id' => (string) $me->id]]]);
        $this->assertSame('free', $me->fresh()->plan);

        $this->assertSame(2, $me->ownedMixes()->count());
        $this->actingAs($me->refresh())->postJson('/api/mixes', ['name' => 'Three'])->assertForbidden();
    }

    public function test_checkout_is_off_until_pricing_is_on(): void
    {
        config(['billing.enabled' => false]);
        $this->actingAs(User::factory()->create())->post('/api/billing/checkout')->assertNotFound();
    }
}
