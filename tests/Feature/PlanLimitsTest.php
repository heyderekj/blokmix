<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PlanLimitsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['blokmix.uploads_disk' => 'uploads-test', 'blokmix.owners' => ['runs@blokmix.test']]);
        Storage::fake('uploads-test');
    }

    private function owned(User $user, string $name = 'Mine'): Mix
    {
        $mix = Mix::create(['name' => $name]);
        $mix->admit($user, MixRole::Owner);

        return $mix;
    }

    private function clip(string $folder): array
    {
        return [
            "samples/clips/hero/{$folder}/clip.html" => '<section class="mx-hero-'.$folder.'" data-mx-section="hero"></section>',
            "samples/clips/hero/{$folder}/clip.css" => '.mx-hero-'.$folder.' { }',
            "samples/clips/hero/{$folder}/clip.json" => '{"title":"Hero"}',
        ];
    }

    private function upload(Mix $mix, string $id, int $kb): \Illuminate\Testing\TestResponse
    {
        return $this->post("/api/mixes/{$mix->id}/assets", [
            'id' => $id, 'kind' => 'image', 'name' => 'hero.webp', 'mime' => 'image/webp',
            'file' => UploadedFile::fake()->create($id, $kb, 'image/webp'),
        ], ['Accept' => 'application/json']);
    }

    public function test_free_has_one_mix_however_it_starts(): void
    {
        $me = User::factory()->create();
        $first = $this->owned($me);

        $this->actingAs($me)->post('/mixes')->assertSessionHasErrors('mix');
        $this->actingAs($me)->post('/mixes', ['name' => 'Starter', 'site' => ['pages' => [['path' => '/']]]])->assertSessionHasErrors('mix');
        $this->actingAs($me)->postJson('/api/mixes', ['name' => 'Imported'])->assertForbidden()->assertJsonPath('message', 'Free has one mix. Archive it, or get a mix pack: 3 mixes for $20, once.');
        $this->actingAs($me)->postJson("/api/mixes/{$first->id}/duplicate")->assertForbidden();
        $this->assertSame(1, $me->ownedMixes()->count());

        // Mixes shared with you don't count, and deleting yours makes room.
        $theirs = $this->owned(User::factory()->create(), 'Theirs');
        $theirs->admit($me, MixRole::Editor);
        $first->delete();
        $this->actingAs($me)->postJson('/api/mixes', ['name' => 'Fresh'])->assertCreated();
    }

    public function test_each_mix_pack_holds_three_mixes(): void
    {
        $me = User::factory()->create();
        $me->forceFill(['mix_packs' => 1])->save();
        foreach (['One', 'Two', 'Three'] as $name) {
            $this->actingAs($me)->postJson('/api/mixes', ['name' => $name])->assertCreated();
        }
        $this->actingAs($me)->postJson('/api/mixes', ['name' => 'Four'])->assertForbidden()
            ->assertJsonPath('message', 'Your mix packs hold 3 mixes. Archive one, or add a pack: 3 more for $20.');

        // Packs stack.
        $me->forceFill(['mix_packs' => 2])->save();
        $this->actingAs($me)->postJson('/api/mixes', ['name' => 'Four'])->assertCreated();
        $this->assertSame(['mixes' => 6, 'clips' => null, 'upload_mb' => 10 * 1024, 'collections' => null, 'entries' => null], $me->fresh()->limits());
    }

    public function test_archiving_a_mix_frees_its_place(): void
    {
        $me = User::factory()->create();
        $first = $this->owned($me);
        $this->actingAs($me)->postJson("/api/mixes/{$first->id}/archive")->assertOk();
        $this->actingAs($me)->postJson('/api/mixes', ['name' => 'Second'])->assertCreated();

        // It can't come back while the other one is open.
        $this->actingAs($me)->postJson("/api/mixes/{$first->id}/unarchive")->assertForbidden();
        $this->assertTrue($first->fresh()->isArchived());

        // An archived mix keeps only marks from saves, and takes no uploads.
        $first->update(['data' => ['site' => ['pages' => []], 'notes' => []]]);
        $this->actingAs($me)->putJson("/api/mixes/{$first->id}", ['data' => ['site' => ['changed' => true], 'notes' => [['id' => 'n1']]]], ['If-Match' => '"1"'])->assertOk();
        $this->assertSame(['site' => ['pages' => []], 'notes' => [['id' => 'n1']]], $first->fresh()->data);
        $this->actingAs($me)->upload($first, 'img_aaaa1111', 10)->assertForbidden();

        // Only the owner archives, and the board hears it's archived.
        $editor = User::factory()->create();
        $first->admit($editor, MixRole::Editor);
        $this->actingAs($editor)->postJson("/api/mixes/{$first->id}/unarchive")->assertForbidden();
        $this->actingAs($me)->getJson("/api/mixes/{$first->id}")->assertJsonPath('archived', true)->assertJsonPath('paid', false);
    }

    public function test_what_a_mix_opens_follows_its_owner(): void
    {
        $owner = User::factory()->create();
        $owner->forceFill(['mix_packs' => 1])->save();
        $mix = $this->owned($owner);
        $editor = User::factory()->create();
        $mix->admit($editor, MixRole::Editor);

        $this->assertSame('free', $editor->planName());
        $this->actingAs($editor)->getJson("/api/mixes/{$mix->id}")->assertJsonPath('paid', true);
    }

    public function test_plus_and_the_people_who_run_blokmix_have_no_mix_limit(): void
    {
        $plus = User::factory()->create();
        $plus->forceFill(['plan' => 'plus'])->save();
        $this->owned($plus);
        $this->actingAs($plus)->postJson('/api/mixes', ['name' => 'Second'])->assertCreated();

        $runs = User::factory()->create(['email' => 'runs@blokmix.test']);
        $this->owned($runs);
        $this->actingAs($runs)->postJson('/api/mixes', ['name' => 'Second'])->assertCreated();
        $this->assertSame('paid', $runs->planName());
        $this->assertNull($runs->mixSlots());
    }

    public function test_free_has_forty_clips_and_saving_one_again_is_fine(): void
    {
        config(['blokmix.plans.free.clips' => 2]);
        $me = User::factory()->create();
        $this->actingAs($me)->postJson('/api/clips', ['files' => $this->clip('acme-one')])->assertCreated();
        $this->actingAs($me)->postJson('/api/clips', ['files' => $this->clip('acme-two')])->assertCreated();
        $this->actingAs($me)->postJson('/api/clips', ['files' => $this->clip('acme-three')])->assertForbidden()->assertJsonPath('message', 'Free includes 2 clips. Remove one to make room, or get a mix pack for as many as you like.');
        $this->actingAs($me)->postJson('/api/clips', ['files' => $this->clip('acme-two')])->assertCreated();
        $this->assertSame(2, $me->clips()->count());
    }

    public function test_uploads_count_toward_the_mix_owner(): void
    {
        config(['blokmix.plans.free.upload_mb' => 1]);
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $mix = $this->owned($owner);
        $mix->admit($editor, MixRole::Editor);

        $this->actingAs($owner)->upload($mix, 'img_aaaa1111', 700)->assertCreated();
        // The editor's upload goes over the owner's 1 MB.
        $this->actingAs($editor)->upload($mix, 'img_bbbb2222', 400)->assertForbidden()->assertJsonPath('message', 'This mix’s owner is out of room for images and video. It stays in this browser.');
        // Replacing an upload only counts the difference.
        $this->actingAs($owner)->upload($mix, 'img_aaaa1111', 900)->assertCreated();
        $this->actingAs($owner)->upload($mix, 'img_cccc3333', 200)->assertForbidden();
        $this->assertSame(900 * 1024, $owner->usage()['uploads']);
    }

    public function test_the_mixes_page_gets_the_plan_and_whats_used(): void
    {
        $me = User::factory()->create();
        $this->owned($me);
        $me->clips()->create(['clip_id' => 'hero.acme-one', 'files' => $this->clip('acme-one')]);

        $this->actingAs($me)->get('/')->assertInertia(fn (Assert $page) => $page
            ->where('auth.plan.name', 'free')
            ->where('auth.plan.limits', ['mixes' => 1, 'clips' => 40, 'upload_mb' => 100, 'collections' => 1, 'entries' => 25])
            ->where('auth.plan.usage', ['mixes' => 1, 'clips' => 1, 'collections' => 0, 'uploads' => 0])
            ->where('auth.plan.packs', 0)
            ->where('auth.plan.pack', ['mixes' => 3, 'price_usd' => 20])
            ->where('auth.plan.buy', false));
    }

    public function test_plan_cant_be_set_by_signing_up(): void
    {
        $this->post('/register', ['name' => 'Pat', 'email' => 'pat@example.com', 'password' => 'a-long-password-1', 'password_confirmation' => 'a-long-password-1', 'plan' => 'plus']);
        $this->assertSame('free', User::where('email', 'pat@example.com')->value('plan'));
    }
}
