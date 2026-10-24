<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClipsTest extends TestCase
{
    use RefreshDatabase;

    private function files(string $folder = 'acme-split'): array
    {
        return [
            "samples/clips/hero/{$folder}/clip.html" => '<section class="mx-hero-'.$folder.'" data-mx-section="hero"></section>',
            "samples/clips/hero/{$folder}/clip.css" => '.mx-hero-'.$folder.' { }',
            "samples/clips/hero/{$folder}/clip.json" => '{"title":"Split hero"}',
            'samples/sources/acme.json' => '{"id":"acme","name":"Acme"}',
        ];
    }

    public function test_you_get_your_clips_and_those_of_people_you_share_mixes_with(): void
    {
        [$me, $friend, $stranger] = User::factory()->count(3)->create();
        $this->actingAs($me)->postJson('/api/clips', ['files' => $this->files()])->assertCreated()->assertJsonPath('id', 'hero.acme-split');
        $this->actingAs($friend)->postJson('/api/clips', ['files' => $this->files('acme-tall')])->assertCreated();
        $this->actingAs($stranger)->postJson('/api/clips', ['files' => $this->files('acme-wide')])->assertCreated();

        $mix = Mix::create(['name' => 'Shared']);
        $mix->admit($me, MixRole::Owner);
        $mix->admit($friend, MixRole::Editor);

        $ids = collect($this->actingAs($me)->getJson('/api/clips')->assertOk()->json())->pluck('id')->all();
        $this->assertSame(['hero.acme-split', 'hero.acme-tall'], $ids);
    }

    public function test_only_clip_files_one_clip_at_a_time(): void
    {
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/clips', ['files' => ['../../.env' => 'x']])->assertUnprocessable();
        $this->postJson('/api/clips', ['files' => [...$this->files(), ...$this->files('acme-tall')]])->assertUnprocessable();
        $this->postJson('/api/clips', ['files' => ['samples/clips/hero/acme-split/clip.html' => str_repeat('x', 600 * 1024)]])->assertUnprocessable();
    }
}
