<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Free to make, $30 a site when you ship it: no limits on making, a mix ships once it's paid for. */
class SitesTest extends TestCase
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

    private function paid(Mix $mix): Mix
    {
        $mix->forceFill(['paid_at' => now()])->save();

        return $mix;
    }

    private function upload(Mix $mix, string $id, int $kb): TestResponse
    {
        return $this->post("/api/mixes/{$mix->id}/assets", [
            'id' => $id, 'kind' => 'image', 'name' => 'hero.webp', 'mime' => 'image/webp',
            'file' => UploadedFile::fake()->create($id, $kb, 'image/webp'),
        ], ['Accept' => 'application/json']);
    }

    public function test_everyone_has_as_many_mixes_as_they_like(): void
    {
        $me = User::factory()->create();
        $first = $this->owned($me);
        $this->actingAs($me)->post('/mixes', ['name' => 'Second'])->assertRedirect();
        $this->actingAs($me)->post('/mixes', ['name' => 'Starter', 'site' => ['pages' => [['path' => '/']]]])->assertRedirect();
        $this->actingAs($me)->postJson('/api/mixes', ['name' => 'Imported'])->assertCreated();
        $this->actingAs($me)->postJson("/api/mixes/{$first->id}/duplicate")->assertCreated();
        $this->assertSame(5, $me->ownedMixes()->count());
    }

    public function test_a_mix_ships_only_once_its_paid_for(): void
    {
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $this->actingAs($me)->getJson("/api/mixes/{$mix->id}")->assertJsonPath('ships', false);
        $this->actingAs($me)->get("/{$mix->short}")->assertInertia(fn (Assert $page) => $page->where('mix.ships', false));

        $this->paid($mix);
        $this->actingAs($me)->getJson("/api/mixes/{$mix->id}")->assertJsonPath('ships', true);
        $this->actingAs($me)->get("/{$mix->short}")->assertInertia(fn (Assert $page) => $page->where('mix.ships', true));

        // Whoever opens it: editors and viewers see the same.
        $editor = User::factory()->create();
        $mix->admit($editor, MixRole::Editor);
        $this->actingAs($editor)->getJson("/api/mixes/{$mix->id}")->assertJsonPath('ships', true);
    }

    public function test_paying_cant_be_saved_from_the_board(): void
    {
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $this->actingAs($me)->putJson("/api/mixes/{$mix->id}", ['data' => ['site' => ['pages' => []]], 'paid_at' => now()->toIso8601String(), 'ships' => true], ['If-Match' => '"1"'])->assertOk();
        $this->assertFalse($mix->fresh()->isPaid());
    }

    public function test_waitlist_mode_ships_every_mix(): void
    {
        config(['blokmix.waitlist_mode' => true]);
        $me = User::factory()->create();
        $mix = $this->owned($me);

        $this->assertFalse($mix->isPaid());
        $this->actingAs($me)->getJson("/api/mixes/{$mix->id}")->assertJsonPath('ships', true);
        $this->actingAs($me)->get('/local')->assertInertia(fn (Assert $page) => $page->where('mix.ships', true));
    }

    public function test_plus_from_before_ships_every_mix_its_owner_has(): void
    {
        $plus = User::factory()->create();
        $plus->forceFill(['plan' => 'plus'])->save();
        $mix = $this->owned($plus);
        $editor = User::factory()->create();
        $mix->admit($editor, MixRole::Editor);

        $this->actingAs($editor)->getJson("/api/mixes/{$mix->id}")->assertJsonPath('ships', true);
        // It follows the owner: the editor's own mixes still ask.
        $theirs = $this->owned($editor);
        $this->actingAs($editor)->getJson("/api/mixes/{$theirs->id}")->assertJsonPath('ships', false);
    }

    public function test_the_people_who_run_blokmix_ship_every_mix(): void
    {
        $runs = User::factory()->create(['email' => 'runs@blokmix.test']);
        $mix = $this->owned($runs);
        $this->actingAs($runs)->getJson("/api/mixes/{$mix->id}")->assertJsonPath('ships', true);
        $this->actingAs($runs)->get('/local')->assertInertia(fn (Assert $page) => $page->where('mix.ships', true));
    }

    public function test_the_browser_only_mix_ships_only_with_plus(): void
    {
        $me = User::factory()->create();
        $this->actingAs($me)->get('/local')->assertInertia(fn (Assert $page) => $page->where('mix.ships', false));
    }

    public function test_a_duplicate_is_a_new_site_unpaid(): void
    {
        $me = User::factory()->create();
        $mix = $this->paid($this->owned($me, 'Fern & Co'));
        $this->actingAs($me)->postJson("/api/mixes/{$mix->id}/duplicate")->assertCreated()
            ->assertJsonPath('name', 'Fern & Co copy')->assertJsonPath('ships', false);
        $copy = Mix::where('name', 'Fern & Co copy')->sole();
        $this->assertFalse($copy->isPaid());
        $this->assertNull($copy->paid_order_id);
        $this->assertTrue($mix->fresh()->isPaid());
    }

    public function test_archiving_keeps_a_mix_read_only(): void
    {
        $me = User::factory()->create();
        $first = $this->owned($me);
        $this->actingAs($me)->postJson("/api/mixes/{$first->id}/archive")->assertOk();

        // An archived mix keeps only marks from saves, and takes no uploads.
        $first->update(['data' => ['site' => ['pages' => []], 'notes' => []]]);
        $this->actingAs($me)->putJson("/api/mixes/{$first->id}", ['data' => ['site' => ['changed' => true], 'notes' => [['id' => 'n1']]]], ['If-Match' => '"1"'])->assertOk();
        $this->assertSame(['site' => ['pages' => []], 'notes' => [['id' => 'n1']]], $first->fresh()->data);
        $this->actingAs($me)->upload($first, 'img_aaaa1111', 10)->assertForbidden();

        // Only the owner brings it back, and the board hears it's archived.
        $editor = User::factory()->create();
        $first->admit($editor, MixRole::Editor);
        $this->actingAs($editor)->postJson("/api/mixes/{$first->id}/unarchive")->assertForbidden();
        $this->actingAs($me)->getJson("/api/mixes/{$first->id}")->assertJsonPath('archived', true);
        $this->actingAs($me)->postJson("/api/mixes/{$first->id}/unarchive")->assertOk();
        $this->assertFalse($first->fresh()->isArchived());
    }

    public function test_room_grows_once_a_site_is_paid_for(): void
    {
        $me = User::factory()->create();
        $mix = $this->owned($me);
        $this->assertSame(100, $me->uploadMb());
        $this->paid($mix);
        $this->assertSame(10 * 1024, $me->uploadMb());

        $plus = User::factory()->create();
        $plus->forceFill(['plan' => 'plus'])->save();
        $this->assertSame(10 * 1024, $plus->uploadMb());
    }

    public function test_clips_have_no_limit(): void
    {
        $me = User::factory()->create();
        foreach (['acme-one', 'acme-two', 'acme-three'] as $folder) {
            $this->actingAs($me)->postJson('/api/clips', ['files' => [
                "samples/clips/hero/{$folder}/clip.html" => '<section class="mx-hero-'.$folder.'" data-mx-section="hero"></section>',
                "samples/clips/hero/{$folder}/clip.css" => '.mx-hero-'.$folder.' { }',
                "samples/clips/hero/{$folder}/clip.json" => '{"title":"Hero"}',
            ]])->assertCreated();
        }
        $this->assertSame(3, $me->clips()->count());
    }

    public function test_uploads_count_toward_the_mix_owner(): void
    {
        config(['blokmix.upload_mb.default' => 1]);
        $owner = User::factory()->create();
        $editor = User::factory()->create();
        $mix = $this->owned($owner);
        $mix->admit($editor, MixRole::Editor);

        $this->actingAs($owner)->upload($mix, 'img_aaaa1111', 700)->assertCreated();
        // The editor's upload goes over the owner's 1 MB.
        $this->actingAs($editor)->upload($mix, 'img_bbbb2222', 400)->assertForbidden()->assertJsonPath('message', 'This mix’s owner is out of room for images and video. It stays in this browser.');
        // Replacing an upload only counts the difference.
        $this->actingAs($owner)->upload($mix, 'img_aaaa1111', 900)->assertCreated();
        $this->actingAs($owner)->upload($mix, 'img_cccc3333', 200)->assertForbidden()->assertJsonPath('message', 'That would go over your 1 MB of images and video. It stays in this browser.');
        $this->assertSame(900 * 1024, $owner->usage()['uploads']);
    }

    public function test_the_mixes_page_gets_the_price_and_whats_used(): void
    {
        $me = User::factory()->create();
        $this->owned($me);
        $me->clips()->create(['clip_id' => 'hero.acme-one', 'files' => ['x' => 'y']]);

        $this->actingAs($me)->get('/')->assertInertia(fn (Assert $page) => $page
            ->where('auth.billing.price', 30)
            ->where('auth.billing.buy', false)
            ->where('auth.billing.ships', false)
            ->where('auth.billing.upload_mb', 100)
            ->where('auth.billing.usage', ['clips' => 1, 'collections' => 0, 'uploads' => 0]));
    }

    public function test_plan_cant_be_set_by_signing_up(): void
    {
        $this->post('/register', ['name' => 'Pat', 'email' => 'pat@example.com', 'password' => 'a-long-password-1', 'password_confirmation' => 'a-long-password-1', 'plan' => 'plus']);
        $this->assertSame('free', User::where('email', 'pat@example.com')->value('plan'));
    }
}
