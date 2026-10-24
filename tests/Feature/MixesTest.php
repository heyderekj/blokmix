<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
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

    public function test_the_home_page_lists_your_mixes_and_marks_you_signed_in(): void
    {
        $this->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page->component('mixes/index'))->assertCookie('blokmix_signed_in', '1', false);
        $this->get('/mixes')->assertRedirect('/');
    }

    public function test_signed_out_people_are_asked_to_sign_in(): void
    {
        auth()->logout();
        $this->get('/')->assertRedirect('/login');
        $this->withCookie('blokmix_signed_in', '1')->get('/login')->assertCookieExpired('blokmix_signed_in');
        $this->getJson('/api/mixes/x')->assertUnauthorized();
    }

    public function test_other_peoples_mixes_stay_hidden(): void
    {
        $theirs = Mix::create(['name' => 'Theirs']);
        $theirs->admit(User::factory()->create(), MixRole::Owner);

        $this->get('/')->assertInertia(fn (Assert $page) => $page->has('mixes', 0));
        $this->get("/{$theirs->short}")->assertNotFound();
        $this->get("/mixes/{$theirs->id}")->assertNotFound();
        $this->getJson("/api/mixes/{$theirs->id}")->assertNotFound();
        $this->putJson("/api/mixes/{$theirs->id}", ['name' => 'Mine now'], ['If-Match' => '"1"'])->assertNotFound();
    }

    public function test_mixes_lists_saved_ones_newest_first(): void
    {
        $this->mine(['name' => 'Older'])->forceFill(['updated_at' => now()->subDay()])->save();
        $this->mine(['name' => 'Newer'])->versions()->create(['key' => 'v_A', 'letter' => 'A', 'node' => $this->node('A')]);

        $this->get('/')
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
        $response->assertRedirect("/{$mix->short}");
        $this->assertNull($mix->data);

        $this->get("/{$mix->short}")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('mixes/show')->where('mix.id', $mix->id)->where('mix.lock', 1)->where('mix.data', null)->where('role', 'owner'));
    }

    public function test_a_new_mix_can_start_from_a_style_guide(): void
    {
        $guide = ['base' => ['color.primary' => '#7a4fd1'], 'candidates' => [['id' => 'hero.a#color']], 'choices' => ['color.text' => 'x']];
        $this->post('/mixes', ['guide' => $guide])->assertRedirect();
        $this->assertSame(['guide' => $guide], Mix::sole()->data);

        $this->post('/mixes', ['guide' => ['choices' => []]])->assertSessionHasErrors('guide.base');
    }

    public function test_the_browser_mix_still_opens(): void
    {
        $this->get('/local')->assertInertia(fn (Assert $page) => $page->component('mixes/show')->where('mix.id', 'local'));
        $this->get('/mixes/local')->assertRedirect('/local');
        $this->get('/mixes/nope')->assertNotFound();
        $this->get('/k3x8')->assertNotFound();
    }

    public function test_a_mix_lives_at_a_short_address(): void
    {
        $mix = $this->mine(['name' => 'Short']);
        $this->assertMatchesRegularExpression('/^'.Mix::SHORT_PATTERN.'$/', $mix->short);
        $this->assertSame(4, strlen($mix->short));
        $this->assertMatchesRegularExpression('/[0-9]/', $mix->short);
        $this->assertDoesNotMatchRegularExpression('/[ilo01]/', $mix->short);

        // Old addresses forward to it, for members only.
        $this->get("/mixes/{$mix->id}")->assertStatus(301)->assertRedirect("/{$mix->short}");
        $this->get("/{$mix->short}")->assertInertia(fn (Assert $page) => $page->where('mix.short', $mix->short)->where('mix.id', $mix->id));
        // Words never match (no digit), so they stay the website's.
        $this->get('/about')->assertNotFound();
    }

    public function test_the_gallery_gets_enough_to_draw_each_mix(): void
    {
        $mix = $this->mine(['name' => 'Drawn', 'data' => [
            'site' => [
                'pages' => [['id' => 'p1', 'path' => '/', 'title' => 'Home', 'show' => ['nav' => true, 'footer' => false], 'slots' => [['type' => 'hero', 'words' => ['headline' => 'Clip the web.']], ['type' => 'features']]]],
                'shared' => ['nav' => ['type' => 'nav'], 'footer' => ['type' => 'footer']],
            ],
            'guide' => ['base' => ['color.primary' => '#ff69b4'], 'candidates' => [], 'choices' => []],
            'notes' => [['status' => 'open'], ['status' => 'resolved']],
        ]]);
        $mix->versions()->create(['key' => 'v_A', 'letter' => 'A', 'node' => [...$this->node('A'), 'status' => 'approved']]);

        $this->get('/')->assertInertia(fn (Assert $page) => $page
            ->where('mixes.0.short', $mix->short)
            ->where('mixes.0.sections', ['nav', 'hero', 'features'])
            ->where('mixes.0.pages', 1)
            ->where('mixes.0.guide.base', ['color.primary' => '#ff69b4'])
            ->where('mixes.0.heads', [['letter' => 'A', 'status' => 'approved']])
            ->where('mixes.0.marks', 1)
            ->where('mixes.0.heading', 'Clip the web.'));
    }

    public function test_renaming_from_the_gallery_keeps_the_lock(): void
    {
        $mix = $this->mine(['name' => 'Old']);
        $this->patchJson("/api/mixes/{$mix->id}/name", ['name' => '  New name '])->assertOk()->assertJson(['name' => 'New name']);
        $this->assertSame('New name', $mix->fresh()->name);
        $this->assertSame(1, $mix->fresh()->lock_version);

        $viewer = User::factory()->create();
        $mix->admit($viewer, MixRole::Viewer);
        $this->actingAs($viewer)->patchJson("/api/mixes/{$mix->id}/name", ['name' => 'Nope'])->assertForbidden();
        $this->actingAs(User::factory()->create())->patchJson("/api/mixes/{$mix->id}/name", ['name' => 'Nope'])->assertNotFound();
    }

    public function test_duplicating_copies_versions_and_uploads_into_a_mix_you_own(): void
    {
        Storage::fake('local');
        config(['blokmix.uploads_disk' => 'local']);
        $theirs = Mix::create(['name' => 'Theirs', 'data' => ['site' => ['pages' => []]]]);
        $theirs->admit(User::factory()->create(), MixRole::Owner);
        $theirs->admit($this->me, MixRole::Viewer);
        $theirs->versions()->create(['key' => 'v_A', 'letter' => 'A', 'node' => $this->node('A')]);
        Storage::disk('local')->put("mixes/{$theirs->id}/img_1", 'pixels');
        $theirs->assets()->create(['key' => 'img_1', 'kind' => 'image', 'name' => 'a.webp', 'mime' => 'image/webp', 'path' => "mixes/{$theirs->id}/img_1"]);

        $res = $this->postJson("/api/mixes/{$theirs->id}/duplicate")->assertCreated()->assertJsonPath('name', 'Theirs copy');
        $copy = Mix::findOrFail($res->json('id'));
        $this->assertSame(MixRole::Owner, $copy->roleOf($this->me));
        $this->assertNotSame($theirs->short, $copy->short);
        $this->assertSame(['v_A'], $copy->versions()->pluck('key')->all());
        $this->assertSame("mixes/{$copy->id}/img_1", $copy->assets()->value('path'));
        Storage::disk('local')->assertExists("mixes/{$copy->id}/img_1");

        $this->actingAs(User::factory()->create())->postJson("/api/mixes/{$theirs->id}/duplicate")->assertNotFound();
    }

    public function test_short_addresses_are_unique(): void
    {
        $shorts = collect(range(1, 40))->map(fn () => $this->mine(['name' => 'Many'])->short);
        $this->assertCount(40, $shorts->unique());
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
