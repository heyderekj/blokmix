<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StyleGuidesTest extends TestCase
{
    use RefreshDatabase;

    private function guide(string $primary = '#7a4fd1'): array
    {
        return ['base' => ['color.primary' => $primary, 'font.display' => 'Unbounded'], 'candidates' => [['id' => 'hero.a#color']], 'choices' => (object) []];
    }

    public function test_you_save_list_and_delete_your_own_guides(): void
    {
        [$me, $other] = User::factory()->count(2)->create();
        $id = $this->actingAs($me)->postJson('/api/style-guides', ['name' => 'Dusk', 'guide' => $this->guide()])
            ->assertCreated()->assertJsonPath('name', 'Dusk')->json('id');
        $this->actingAs($other)->postJson('/api/style-guides', ['name' => 'Theirs', 'guide' => $this->guide('#000000')])->assertCreated();

        $this->actingAs($me)->getJson('/api/style-guides')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.name', 'Dusk')->assertJsonPath('0.guide.base', ['color.primary' => '#7a4fd1', 'font.display' => 'Unbounded'])->assertJsonPath('0.guide.candidates', [['id' => 'hero.a#color']]);

        // Someone else's guide isn't yours to delete.
        $this->actingAs($other)->deleteJson("/api/style-guides/{$id}")->assertNotFound();
        $this->actingAs($me)->deleteJson("/api/style-guides/{$id}")->assertNoContent();
        $this->actingAs($me)->getJson('/api/style-guides')->assertJsonCount(0);
    }

    public function test_saving_under_the_same_name_updates_it(): void
    {
        $me = User::factory()->create();
        $this->actingAs($me)->postJson('/api/style-guides', ['name' => 'Dusk', 'guide' => $this->guide()])->assertCreated();
        $this->actingAs($me)->postJson('/api/style-guides', ['name' => ' Dusk ', 'guide' => $this->guide('#111111')])->assertOk();
        $saved = $this->actingAs($me)->getJson('/api/style-guides')->assertJsonCount(1)->json('0.guide.base');
        $this->assertSame('#111111', $saved['color.primary']);
    }

    public function test_a_guide_needs_a_name_and_base_tokens(): void
    {
        $me = User::factory()->create();
        $this->actingAs($me)->postJson('/api/style-guides', ['name' => '  ', 'guide' => $this->guide()])->assertUnprocessable();
        $this->actingAs($me)->postJson('/api/style-guides', ['name' => 'X', 'guide' => ['choices' => []]])->assertUnprocessable();
    }

    public function test_signed_out_gets_nothing(): void
    {
        $this->getJson('/api/style-guides')->assertUnauthorized();
    }
}
