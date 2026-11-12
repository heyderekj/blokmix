<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\BillingOrder;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** A site paid for at Polar: a signed webhook marks the mix paid once, a full refund un-pays it. */
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
            'billing.polar.products.site' => 'prod_site',
            'billing.polar.products.plus' => 'prod_plus',
            'blokmix.owners' => ['runs@blokmix.test'],
        ]);
    }

    private function deliver(array $event, ?string $secret = null): TestResponse
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

    private function owned(User $user, string $name = 'Fern & Co'): Mix
    {
        $mix = Mix::create(['name' => $name]);
        $mix->admit($user, MixRole::Owner);

        return $mix;
    }

    private function order(User $user, ?Mix $mix, string $id = 'ord_1', string $product = 'prod_site'): array
    {
        return ['type' => 'order.paid', 'data' => [
            'id' => $id, 'product_id' => $product, 'customer_id' => 'cus_1', 'total_amount' => 3000,
            'customer' => ['id' => 'cus_1', 'external_id' => (string) $user->id],
            'metadata' => array_filter(['user_id' => (string) $user->id, 'mix_id' => $mix?->id, 'product' => 'site']),
        ]];
    }

    private function refund(User $user, string $id = 'ord_1', string $status = 'refunded'): array
    {
        return ['type' => 'order.refunded', 'data' => ['id' => $id, 'status' => $status, 'customer' => ['external_id' => (string) $user->id]]];
    }

    public function test_a_paid_order_pays_for_its_mix(): void
    {
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $other = $this->owned($me, 'Second');
        $this->assertFalse($mix->ships());

        $this->deliver($this->order($me, $mix))->assertStatus(202);

        $mix->refresh();
        $this->assertTrue($mix->isPaid());
        $this->assertTrue($mix->ships());
        $order = BillingOrder::sole();
        $this->assertSame($mix->id, $order->mix_id);
        $this->assertSame($order->id, $mix->paid_order_id);
        $this->assertSame('site', $order->product_key);
        $this->assertSame(3000, $order->amount_cents);
        $this->assertSame('cus_1', $me->fresh()->polar_customer_id);
        // One site: the owner's other mixes still ask, and nobody gets Plus.
        $this->assertFalse($other->fresh()->ships());
        $this->assertFalse($me->fresh()->hasPlus());
        $this->actingAs($me)->getJson("/api/mixes/{$mix->id}")->assertJsonPath('ships', true);
    }

    public function test_a_redelivered_webhook_pays_once(): void
    {
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $this->deliver($this->order($me, $mix))->assertStatus(202);
        $paidAt = $mix->fresh()->paid_at;
        $this->travel(1)->hours();
        $this->deliver($this->order($me, $mix))->assertStatus(202);

        $this->assertSame(1, BillingOrder::count());
        $this->assertEquals($paidAt, $mix->fresh()->paid_at);
    }

    public function test_an_editor_can_pay_for_a_mix_they_dont_own(): void
    {
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $mix = $this->owned($owner);
        $mix->admit($editor, MixRole::Editor);

        $this->deliver($this->order($editor, $mix))->assertStatus(202);
        $this->assertTrue($mix->fresh()->isPaid());
        $this->assertSame($editor->id, BillingOrder::sole()->user_id);
    }

    public function test_a_full_refund_unpays_the_mix_and_keeps_the_work(): void
    {
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $mix->versions()->create(['key' => 'v1', 'letter' => 'A', 'node' => ['letter' => 'A']]);
        $this->deliver($this->order($me, $mix))->assertStatus(202);

        // A partial refund changes nothing.
        $this->deliver($this->refund($me, status: 'partially_refunded'))->assertStatus(202);
        $this->assertTrue($mix->fresh()->isPaid());

        $this->deliver($this->refund($me))->assertStatus(202);
        $mix->refresh();
        $this->assertFalse($mix->isPaid());
        $this->assertFalse($mix->ships());
        $this->assertNull($mix->paid_order_id);
        $this->assertNotNull(BillingOrder::sole()->refunded_at);
        // Nothing is taken away: the mix and its versions stay, and it still opens.
        $this->assertSame(1, $mix->versions()->count());
        $this->actingAs($me)->getJson("/api/mixes/{$mix->id}")->assertOk()->assertJsonPath('ships', false);

        // Redelivered, the refund does nothing more.
        $this->deliver($this->refund($me))->assertStatus(202);
        $this->assertFalse($mix->fresh()->isPaid());
    }

    public function test_a_second_payment_for_the_same_mix_keeps_it_paid_through_one_refund(): void
    {
        $me = User::factory()->create();
        $editor = User::factory()->create();
        $mix = $this->owned($me);
        $mix->admit($editor, MixRole::Editor);
        $this->deliver($this->order($me, $mix, 'ord_1'));
        $this->deliver($this->order($editor, $mix, 'ord_2'));
        $first = BillingOrder::where('polar_order_id', 'ord_1')->sole();
        $this->assertSame($first->id, $mix->fresh()->paid_order_id);

        $this->deliver($this->refund($me, 'ord_1'));
        $second = BillingOrder::where('polar_order_id', 'ord_2')->sole();
        $this->assertTrue($mix->fresh()->isPaid());
        $this->assertSame($second->id, $mix->fresh()->paid_order_id);

        $this->deliver($this->refund($editor, 'ord_2'));
        $this->assertFalse($mix->fresh()->isPaid());
    }

    public function test_an_order_for_a_mix_that_is_gone_is_kept_as_a_record(): void
    {
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $mixId = $mix->id;
        $mix->delete();
        $this->deliver(['type' => 'order.paid', 'data' => [
            'id' => 'ord_1', 'product_id' => 'prod_site', 'customer' => ['external_id' => (string) $me->id], 'metadata' => ['mix_id' => $mixId],
        ]])->assertStatus(202);
        $this->assertNull(BillingOrder::sole()->mix_id);
    }

    public function test_a_bad_signature_pays_for_nothing(): void
    {
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $this->deliver($this->order($me, $mix), 'whsec_'.base64_encode('someone-else'))->assertStatus(401);
        $this->assertFalse($mix->fresh()->isPaid());
    }

    public function test_other_products_and_strangers_are_ignored(): void
    {
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $this->deliver(['type' => 'order.paid', 'data' => ['id' => 'ord_x', 'product_id' => 'prod_other', 'customer' => ['external_id' => (string) $me->id], 'metadata' => ['mix_id' => $mix->id]]])->assertStatus(202);
        $this->deliver(['type' => 'order.paid', 'data' => ['id' => 'ord_y', 'product_id' => 'prod_site', 'customer' => ['external_id' => '99999'], 'metadata' => ['mix_id' => $mix->id]]])->assertStatus(202);
        $this->assertFalse($mix->fresh()->isPaid());
        $this->assertSame(0, BillingOrder::count());
    }

    public function test_plus_orders_from_before_still_work(): void
    {
        $me = User::factory()->create();
        $mine = $this->owned($me);
        $this->deliver($this->order($me, null, 'ord_plus', 'prod_plus'))->assertStatus(202);
        $this->assertTrue($me->fresh()->hasPlus());
        $this->assertTrue($mine->fresh()->ships());
        $this->assertFalse($mine->fresh()->isPaid());

        $this->deliver($this->refund($me, 'ord_plus'))->assertStatus(202);
        $this->assertSame('free', $me->fresh()->plan);
        $this->assertFalse($mine->fresh()->ships());
    }

    public function test_checkout_goes_to_polar_with_the_mix_and_the_person(): void
    {
        Http::fake(['*/v1/checkouts/' => Http::response(['id' => 'chk_1', 'url' => 'https://polar.test/checkout/chk_1'])]);
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $mix = $this->owned($owner);
        $mix->admit($editor, MixRole::Editor);

        $this->actingAs($editor)->post("/api/mixes/{$mix->id}/checkout", [], ['X-Inertia' => 'true'])
            ->assertStatus(409)->assertHeader('X-Inertia-Location', 'https://polar.test/checkout/chk_1');

        Http::assertSent(fn (Request $r) => $r['products'] === ['prod_site']
            && $r['external_customer_id'] === (string) $editor->id
            && $r['metadata'] === ['user_id' => (string) $editor->id, 'mix_id' => $mix->id, 'product' => 'site']
            && $r['success_url'] === url("/{$mix->short}").'?paid=1');
    }

    public function test_only_people_who_can_edit_can_pay(): void
    {
        Http::fake();
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $mix = $this->owned($owner);
        $mix->admit($viewer, MixRole::Viewer);

        $this->actingAs($viewer)->post("/api/mixes/{$mix->id}/checkout")->assertForbidden();
        $this->actingAs(User::factory()->create())->post("/api/mixes/{$mix->id}/checkout")->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_a_mix_that_already_ships_cant_be_paid_for_again(): void
    {
        Http::fake();
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $this->deliver($this->order($me, $mix));
        $this->actingAs($me)->post("/api/mixes/{$mix->id}/checkout")->assertSessionHasErrors(['buy' => 'This site is already paid for.']);

        // Plus from before ships every mix its owner has; there's nothing to pay.
        $plus = User::factory()->create();
        $plus->forceFill(['plan' => 'plus'])->save();
        $theirs = $this->owned($plus);
        $this->actingAs($plus)->post("/api/mixes/{$theirs->id}/checkout")->assertSessionHasErrors('buy');
        Http::assertNothingSent();
    }

    public function test_checkout_is_off_until_pricing_is_on(): void
    {
        config(['billing.enabled' => false]);
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $this->actingAs($me)->post("/api/mixes/{$mix->id}/checkout")->assertNotFound();
    }
}
