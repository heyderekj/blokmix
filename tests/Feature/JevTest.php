<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\JevController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class JevTest extends TestCase
{
    use RefreshDatabase;

    private function ask(array $over = []): array
    {
        return array_merge([
            'model' => 'jev-latest',
            'state' => ['link' => ['words' => 'See plans']],
            'questions' => ['to' => ['type' => 'choice', 'instructions' => 'Where does it go?', 'criteria' => ['pricing' => 'The pricing section', 'stay' => null]]],
        ], $over);
    }

    private function answer(): array
    {
        return ['model' => 'jev-1.14.0', 'answers' => ['to' => ['type' => 'choice', 'choice' => 'pricing', 'confidence' => 0.9, 'probabilities' => ['pricing' => 0.93, 'stay' => 0.07]]], 'usage' => ['input_tokens' => 80, 'output_tokens' => 4]];
    }

    /** A real JPEG of the given size, base64. */
    private function jpeg(int $w, int $h): string
    {
        $img = imagecreatetruecolor($w, $h);
        ob_start();
        imagejpeg($img);

        return base64_encode((string) ob_get_clean());
    }

    public function test_it_says_whether_jev_is_on(): void
    {
        $me = User::factory()->create();
        config(['blokmix.jev_key' => null]);
        $this->actingAs($me)->getJson('/api/jev/status')->assertOk()->assertExactJson(['on' => false]);
        config(['blokmix.jev_key' => 'ts_test']);
        $this->actingAs($me)->getJson('/api/jev/status')->assertOk()->assertExactJson(['on' => true]);
    }

    public function test_it_needs_you_signed_in_and_a_key(): void
    {
        config(['blokmix.jev_key' => null]);
        $this->postJson('/api/jev', $this->ask())->assertUnauthorized();
        $this->actingAs(User::factory()->create())->postJson('/api/jev', $this->ask())->assertStatus(503);
    }

    public function test_it_passes_the_body_on_exactly_and_returns_the_answers(): void
    {
        config(['blokmix.jev_key' => 'ts_test']);
        Http::fake(['api.typesafe.ai/*' => Http::response($this->answer())]);
        // An empty object in the state must stay an object on the way through.
        $raw = json_encode($this->ask(['state' => ['link' => ['words' => 'See plans'], 'extra' => (object) []]]));

        $this->actingAs(User::factory()->create())
            ->call('POST', '/api/jev', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], $raw)
            ->assertOk()->assertJsonPath('answers.to.choice', 'pricing');

        Http::assertSent(fn (ClientRequest $r) => $r->url() === 'https://api.typesafe.ai/v1/systemone'
            && $r->hasHeader('Authorization', 'Bearer ts_test')
            && ! $r->hasHeader('TypeSafe-Danger-Zone-Images')
            && $r->body() === $raw);
    }

    public function test_pictures_turn_on_the_image_header_and_are_checked(): void
    {
        config(['blokmix.jev_key' => 'ts_test']);
        Http::fake(['api.typesafe.ai/*' => Http::response($this->answer())]);
        $me = User::factory()->create();
        $photo = fn (string $data) => $this->ask([
            'model' => 'jev-preview',
            'state' => ['photo' => '<img:p>'],
            'questions' => ['subject' => ['type' => 'box', 'instructions' => 'The main subject of `photo`']],
            'assets' => ['<img:p>' => ['type' => 'image', 'format' => 'jpg', 'data_base64' => $data]],
        ]);

        $this->actingAs($me)->postJson('/api/jev', $photo($this->jpeg(400, 300)))->assertOk();
        Http::assertSent(fn (ClientRequest $r) => $r->hasHeader('TypeSafe-Danger-Zone-Images', 'true'));

        // Too small for Jev, or not a picture at all.
        $this->actingAs($me)->postJson('/api/jev', $photo($this->jpeg(200, 300)))->assertStatus(422);
        $this->actingAs($me)->postJson('/api/jev', $photo(base64_encode('not a picture')))->assertStatus(422);
    }

    public function test_it_refuses_requests_blokmix_would_not_send(): void
    {
        config(['blokmix.jev_key' => 'ts_test']);
        Http::fake();
        $me = User::factory()->create();
        $this->actingAs($me)->postJson('/api/jev', $this->ask(['model' => 'gpt-9']))->assertStatus(422);
        $this->actingAs($me)->postJson('/api/jev', $this->ask(['questions' => [['type' => 'noul']]]))->assertStatus(422);
        $this->actingAs($me)->postJson('/api/jev', $this->ask(['questions' => ['x' => ['type' => 'essay']]]))->assertStatus(422);
        $many = [];
        for ($i = 0; $i < 201; $i++) {
            $many["q{$i}"] = ['type' => 'noul', 'instructions' => 'Yes?'];
        }
        $this->actingAs($me)->postJson('/api/jev', $this->ask(['questions' => $many]))->assertStatus(422);
        Http::assertNothingSent();
    }

    public function test_wants_are_counted_by_name_only_and_owners_see_them(): void
    {
        $me = User::factory()->create();
        $this->actingAs($me)->postJson('/api/jev/wants', ['want' => 'menu', 'feature' => 'pour', 'kind' => 'local'])->assertNoContent();
        $this->actingAs($me)->postJson('/api/jev/wants', ['want' => 'menu', 'feature' => 'say'])->assertNoContent();
        $this->actingAs($me)->postJson('/api/jev/wants', ['want' => 'countdown', 'feature' => 'say', 'section_type' => 'hero'])->assertNoContent();
        // Words never fit the shape of a want.
        $this->actingAs($me)->postJson('/api/jev/wants', ['want' => 'A menu for my bakery please', 'feature' => 'say'])->assertStatus(422);
        $this->actingAs($me)->postJson('/api/jev/wants', ['want' => 'menu', 'feature' => 'email'])->assertStatus(422);

        $this->assertSame(['menu', 'countdown'], array_column(JevController::wantCounts(), 'want'));
        $this->assertSame(['want' => 'menu', 'count' => 2, 'from' => ['pour' => 1, 'say' => 1]], JevController::wantCounts()[0]);
        $this->assertDatabaseMissing('jev_wants', ['want' => 'A menu for my bakery please']);
    }
}
