<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MixesTest extends TestCase
{
    use RefreshDatabase;

    private User $me;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->me = User::factory()->create();
        $this->actingAs($this->me);
    }

    /** A mix I own. */
    private function mine(array $attributes): Mix
    {
        $mix = Mix::create($attributes);
        $mix->admit($this->me, MixRole::Owner);

        return $mix;
    }

    private function node(string $letter): array
    {
        return ['id' => "v_$letter", 'letter' => $letter, 'title' => "Version $letter", 'snapshot' => ['site' => ['pages' => []]]];
    }

    public function test_the_home_page_lists_mixes(): void
    {
        $this->get('/')->assertRedirect('/mixes');
    }

    public function test_signed_out_people_are_asked_to_sign_in(): void
    {
        auth()->logout();
        $this->get('/mixes')->assertRedirect('/login');
        $this->getJson('/api/mixes/x')->assertUnauthorized();
    }

    public function test_other_peoples_mixes_stay_hidden(): void
    {
        $theirs = Mix::create(['name' => 'Theirs']);
        $theirs->admit(User::factory()->create(), MixRole::Owner);

        $this->get('/mixes')->assertInertia(fn (Assert $page) => $page->has('mixes', 0));
        $this->get("/mixes/{$theirs->id}")->assertNotFound();
        $this->getJson("/api/mixes/{$theirs->id}")->assertNotFound();
        $this->putJson("/api/mixes/{$theirs->id}", ['name' => 'Mine now'], ['If-Match' => '"1"'])->assertNotFound();
    }

    public function test_mixes_lists_saved_ones_newest_first(): void
    {
        $this->mine(['name' => 'Older'])->forceFill(['updated_at' => now()->subDay()])->save();
        $this->mine(['name' => 'Newer'])->versions()->create(['key' => 'v_A', 'letter' => 'A', 'node' => $this->node('A')]);

        $this->get('/mixes')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('mixes/index')
                ->has('mixes', 2)
                ->where('mixes.0.name', 'Newer')
                ->where('mixes.0.versions', 1));
    }

    public function test_a_new_mix_starts_blank_and_opens(): void
    {
        $response = $this->post('/mixes');
        $mix = Mix::sole();
        $this->assertSame(MixRole::Owner, $mix->roleOf($this->me));
        $response->assertRedirect("/mixes/{$mix->id}");
        $this->assertNull($mix->data);

        $this->get("/mixes/{$mix->id}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('mixes/show')->where('mix.id', $mix->id)->where('mix.lock', 1)->where('mix.data', null)->where('role', 'owner'));
    }

    public function test_the_browser_mix_still_opens(): void
    {
        $this->get('/mixes/local')->assertInertia(fn (Assert $page) => $page->component('mixes/show')->where('mix.id', 'local'));
        $this->get('/mixes/nope')->assertNotFound();
    }

    public function test_saving_a_browser_mix_keeps_its_versions(): void
    {
        $this->postJson('/api/mixes', ['name' => 'Launch', 'data' => ['site' => ['pages' => []]], 'versions' => ['v_A' => $this->node('A')]])
            ->assertCreated()
            ->assertJsonPath('name', 'Launch')
            ->assertJsonPath('versions.v_A.letter', 'A')
            ->assertJsonPath('lock', 1)
            ->assertHeader('ETag', '"1"');
        $this->assertSame(MixRole::Owner, Mix::sole()->roleOf($this->me));
    }

    public function test_saves_send_only_what_changed_and_bump_the_lock(): void
    {
        $mix = $this->mine(['name' => 'Launch', 'data' => ['site' => ['pages' => []], 'notes' => []]]);
        $mix->versions()->create(['key' => 'v_A', 'letter' => 'A', 'node' => $this->node('A')]);

        $this->putJson("/api/mixes/{$mix->id}", ['name' => 'Launch page', 'versions' => ['put' => ['v_B' => $this->node('B')], 'remove' => ['v_A']]], ['If-Match' => '"1"'])
            ->assertOk()
            ->assertJsonPath('lock', 2);

        $saved = $this->getJson("/api/mixes/{$mix->id}")->assertOk();
        $saved->assertJsonPath('name', 'Launch page')->assertJsonPath('lock', 2)->assertJsonPath('data.notes', []);
        $this->assertSame(['v_B'], array_keys($saved->json('versions')));
    }

    public function test_a_mix_is_saved_exactly_as_sent(): void
    {
        $node = $this->node('A') + ['snapshot' => ['site' => ['pages' => [['title' => ' Home ']]], 'content' => ['fields' => ['hero' => ['heading' => '']]]]];
        $data = ['content' => ['fields' => ['hero' => ['heading' => 'Clip the web.  ', 'eyebrow' => '']]]];
        $id = $this->postJson('/api/mixes', ['name' => 'Launch', 'data' => $data, 'versions' => ['v_A' => $node]])->assertCreated()->json('id');

        $saved = $this->getJson("/api/mixes/{$id}")->json();
        $this->assertSame($data, $saved['data']);
        $this->assertSame($node['snapshot'], $saved['versions']['v_A']['snapshot']);

        $this->putJson("/api/mixes/{$id}", ['versions' => ['put' => ['v_B' => $node + ['letter' => 'B']], 'remove' => []]], ['If-Match' => '"1"'])->assertOk();
        $this->assertSame($node['snapshot'], $this->getJson("/api/mixes/{$id}")->json('versions.v_B.snapshot'));
    }

    public function test_a_save_from_an_old_lock_gets_the_mix_as_it_is_now(): void
    {
        $mix = $this->mine(['name' => 'Launch', 'data' => ['notes' => []]]);
        $this->putJson("/api/mixes/{$mix->id}", ['data' => ['notes' => ['first']]], ['If-Match' => '"1"'])->assertOk();

        $this->putJson("/api/mixes/{$mix->id}", ['data' => ['notes' => ['stale']]], ['If-Match' => '"1"'])
            ->assertStatus(412)
            ->assertJsonPath('mix.lock', 2)
            ->assertJsonPath('mix.data.notes', ['first']);
        $this->assertSame(['first'], $mix->refresh()->data['notes']);
    }

    public function test_a_save_must_name_its_lock(): void
    {
        $mix = $this->mine(['name' => 'Launch']);
        $this->putJson("/api/mixes/{$mix->id}", ['name' => 'x'])->assertStatus(428);
        $this->putJson("/api/mixes/{$mix->id}", ['versions' => ['put' => ['v_A' => ['title' => 'no letter']]]], ['If-Match' => '"1"'])->assertUnprocessable();
    }

    public function test_deleting_a_mix_takes_its_versions(): void
    {
        $mix = $this->mine(['name' => 'Launch']);
        $mix->versions()->create(['key' => 'v_A', 'letter' => 'A', 'node' => $this->node('A')]);
        $this->deleteJson("/api/mixes/{$mix->id}")->assertNoContent();
        $this->assertDatabaseCount('mix_versions', 0);
    }
}
