<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Mix packs bought at Polar: signed webhooks grant one per order, a full refund takes it back. */
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
            'billing.polar.products.mix_pack' => 'prod_pack',
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
            'id' => $id, 'product_id' => 'prod_pack', 'customer_id' => 'cus_1', 'total_amount' => 2000,
            'customer' => ['id' => 'cus_1', 'external_id' => (string) $user->id], ...$more,
        ]];
    }

    public function test_a_paid_order_grants_one_pack_once(): void
    {
        $me = User::factory()->create();
        $this->deliver($this->order($me))->assertStatus(202);
        $this->deliver($this->order($me))->assertStatus(202);
        $this->assertSame(1, $me->fresh()->mix_packs);
        $this->assertSame('cus_1', $me->fresh()->polar_customer_id);
        $this->assertSame(3, $me->fresh()->mixSlots());

        $this->deliver($this->order($me, 'ord_2'))->assertStatus(202);
        $this->assertSame(6, $me->fresh()->mixSlots());
    }

    public function test_a_bad_signature_grants_nothing(): void
    {
        $me = User::factory()->create();
        $this->deliver($this->order($me), 'whsec_'.base64_encode('someone-else'))->assertStatus(401);
        $this->assertSame(0, $me->fresh()->mix_packs);
    }

    public function test_other_products_and_strangers_are_ignored(): void
    {
        $me = User::factory()->create();
        $this->deliver(['type' => 'order.paid', 'data' => ['id' => 'ord_x', 'product_id' => 'prod_other', 'customer' => ['external_id' => (string) $me->id]]])->assertStatus(202);
        $this->deliver(['type' => 'order.paid', 'data' => ['id' => 'ord_y', 'product_id' => 'prod_pack', 'customer' => ['external_id' => '99999']]])->assertStatus(202);
        $this->assertSame(0, $me->fresh()->mix_packs);
    }

    public function test_a_full_refund_takes_the_pack_back_and_keeps_the_mixes(): void
    {
        $me = User::factory()->create();
        $this->deliver($this->order($me))->assertStatus(202);
        $me->refresh();
        foreach (['One', 'Two'] as $name) {
            $this->actingAs($me)->postJson('/api/mixes', ['name' => $name])->assertCreated();
        }

        $this->deliver(['type' => 'order.refunded', 'data' => ['id' => 'ord_1', 'status' => 'partially_refunded', 'customer' => ['external_id' => (string) $me->id]]]);
        $this->assertSame(1, $me->fresh()->mix_packs);
        $this->deliver(['type' => 'order.refunded', 'data' => ['id' => 'ord_1', 'status' => 'refunded', 'customer' => ['external_id' => (string) $me->id]]]);
        $this->assertSame(0, $me->fresh()->mix_packs);

        $this->assertSame(2, $me->ownedMixes()->count());
        $this->actingAs($me->refresh())->postJson('/api/mixes', ['name' => 'Three'])->assertForbidden();
    }

    public function test_checkout_is_off_until_pricing_is_on(): void
    {
        config(['billing.enabled' => false]);
        $this->actingAs(User::factory()->create())->post('/api/billing/checkout')->assertNotFound();
    }
}
