<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Collection;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class CollectionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['blokmix.uploads_disk' => 'uploads-test', 'blokmix.owners' => ['runs@blokmix.test']]);
        Storage::fake('uploads-test');
    }

    private function schema(): array
    {
        return [
            'fields' => [
                ['key' => 'title', 'label' => 'Title', 'type' => 'text', 'required' => true],
                ['key' => 'cover', 'label' => 'Cover', 'type' => 'image'],
                ['key' => 'tags', 'label' => 'Tags', 'type' => 'list', 'of' => 'text'],
            ],
            'titleField' => 'title',
            'slugFrom' => 'title',
        ];
    }

    private function entries(int $n): array
    {
        return array_map(fn ($i) => ['id' => "e{$i}", 'slug' => "post-{$i}", 'order' => $i, 'data' => ['title' => "Post {$i}", 'tags' => []], 'updatedAt' => '2026-10-29T00:00:00Z'], range(1, $n));
    }

    private function create(User $user, array $extra = []): array
    {
        return $this->actingAs($user)->postJson('/api/collections', ['slug' => 'posts', 'name' => 'Posts', 'schema' => $this->schema(), 'entries' => $this->entries(2), ...$extra])
            ->assertCreated()->json();
    }

    private function save(string $id, int $lock, array $body, string $query = ''): TestResponse
    {
        return $this->putJson("/api/collections/{$id}{$query}", $body, ['If-Match' => "\"{$lock}\""]);
    }

    /** A mix owned by $owner that binds their "posts" collection, with $member in it as $role. */
    private function boundMix(User $owner, ?User $member = null, MixRole $role = MixRole::Editor): Mix
    {
        $mix = Mix::create(['name' => 'Blog', 'data' => ['site' => ['pages' => [['slots' => [['lists' => ['posts' => ['collection' => 'posts']]]]]]]]]);
        $mix->admit($owner, MixRole::Owner);
        if ($member) {
            $mix->admit($member, $role);
        }

        return $mix;
    }

    public function test_you_create_read_update_and_delete_your_collections(): void
    {
        $me = User::factory()->create();
        $made = $this->create($me);
        $this->assertSame(1, $made['lock']);
        $this->assertSame('owner', $made['role']);
        $this->assertSame('Post 1', $made['entries'][0]['data']['title']);

        $this->getJson("/api/collections/{$made['id']}")->assertOk()->assertHeader('ETag', '"1"')
            ->assertJsonPath('schema.titleField', 'title')->assertJsonPath('schema.fields.2.of', 'text');
        $this->getJson('/api/collections')->assertOk()->assertJsonCount(1)->assertJsonPath('0.slug', 'posts');

        $this->save($made['id'], 1, ['name' => 'Journal', 'entries' => $this->entries(3)])->assertOk()->assertJsonPath('lock', 2);
        $this->getJson("/api/collections/{$made['id']}")->assertJsonPath('name', 'Journal')->assertJsonCount(3, 'entries');
        $this->putJson("/api/collections/{$made['id']}", ['name' => 'No lock'])->assertStatus(428);

        $this->deleteJson("/api/collections/{$made['id']}")->assertNoContent();
        $this->assertSame(0, Collection::count());
    }

    public function test_the_client_may_choose_the_id(): void
    {
        $me = User::factory()->create();
        $id = strtolower((string) Str::ulid());
        $this->create($me, ['id' => $id]);
        $this->assertTrue(Collection::whereKey($id)->exists());
    }

    public function test_slugs_are_unique_per_owner(): void
    {
        [$me, $other] = User::factory()->count(2)->create();
        $first = $this->create($me);
        $this->actingAs($me)->postJson('/api/collections', ['slug' => 'posts', 'name' => 'Again', 'schema' => $this->schema()])
            ->assertStatus(409)->assertJsonPath('errors.slug.0', 'There’s already a collection at that address.');
        $this->actingAs($me)->postJson('/api/collections', ['slug' => 'Bad Slug', 'name' => 'Bad', 'schema' => $this->schema()])->assertUnprocessable();

        // Someone else may use the same slug; renaming into a clash is refused too.
        $this->create($other);
        $team = $this->create($me, ['slug' => 'team', 'name' => 'Team']);
        $this->actingAs($me);
        $this->save($team['id'], 1, ['slug' => 'posts'])->assertStatus(409);
        $this->save($first['id'], 1, ['slug' => 'posts'])->assertOk();
    }

    public function test_a_stale_lock_gets_412_and_the_collection_as_it_is(): void
    {
        $me = User::factory()->create();
        $made = $this->create($me);
        $this->save($made['id'], 1, ['name' => 'First'])->assertOk();
        $this->save($made['id'], 1, ['name' => 'Second'])->assertStatus(412)
            ->assertJsonPath('collection.name', 'First')->assertJsonPath('collection.lock', 2)->assertHeader('ETag', '"2"');
    }

    public function test_mix_editors_change_entries_but_not_the_schema(): void
    {
        [$owner, $editor] = User::factory()->count(2)->create();
        $made = $this->create($owner);
        $mix = $this->boundMix($owner, $editor);
        $id = $made['id'];

        // Without the mix it isn't theirs to see.
        $this->actingAs($editor)->getJson("/api/collections/{$id}")->assertNotFound();
        $this->getJson("/api/collections/{$id}?mix={$mix->id}")->assertOk()->assertJsonPath('role', 'editor');
        $this->getJson("/api/collections/{$id}?mix={$mix->short}")->assertOk();
        $this->getJson('/api/collections')->assertJsonCount(1)->assertJsonPath('0.mix', $mix->id);
        $this->getJson("/api/collections?mix={$mix->id}")->assertJsonCount(1)->assertJsonPath('0.role', 'editor');

        $this->save($id, 1, ['entries' => $this->entries(3)], "?mix={$mix->id}")->assertOk();
        // The schema and name as they are can come along; changing them can't.
        $this->save($id, 2, ['name' => 'Posts', 'schema' => $this->schema(), 'entries' => $this->entries(1)], "?mix={$mix->id}")->assertOk();
        $this->save($id, 3, ['name' => 'Mine now'], "?mix={$mix->id}")->assertForbidden();
        $this->save($id, 3, ['schema' => ['fields' => [], 'titleField' => null, 'slugFrom' => null]], "?mix={$mix->id}")->assertForbidden();
        $this->deleteJson("/api/collections/{$id}?mix={$mix->id}")->assertForbidden();
        $this->assertSame('Posts', Collection::find($id)->name);
        $this->assertCount(1, Collection::find($id)->entries);
    }

    public function test_viewers_read_only_and_strangers_see_nothing(): void
    {
        [$owner, $viewer, $stranger] = User::factory()->count(3)->create();
        $made = $this->create($owner);
        $mix = $this->boundMix($owner, $viewer, MixRole::Viewer);
        $id = $made['id'];

        $this->actingAs($viewer)->getJson("/api/collections/{$id}?mix={$mix->id}")->assertOk()->assertJsonPath('role', 'viewer');
        $this->save($id, 1, ['entries' => []], "?mix={$mix->id}")->assertForbidden();

        $this->actingAs($stranger)->getJson("/api/collections/{$id}")->assertNotFound();
        $this->getJson("/api/collections/{$id}?mix={$mix->id}")->assertNotFound();
        $this->getJson('/api/collections')->assertJsonCount(0);
        $this->save($id, 1, ['entries' => []], "?mix={$mix->id}")->assertNotFound();
        $this->deleteJson("/api/collections/{$id}")->assertNotFound();
    }

    public function test_a_mix_only_opens_collections_it_binds_and_its_owner_can_edit(): void
    {
        [$owner, $intruder] = User::factory()->count(2)->create();
        $made = $this->create($owner);

        // A mix someone else made that names "posts" doesn't reach the owner's collection.
        $theirs = $this->boundMix($intruder);
        $this->actingAs($intruder)->getJson("/api/collections/{$made['id']}?mix={$theirs->id}")->assertNotFound();

        // Nor does a mix the owner is in but that doesn't bind it.
        $plain = Mix::create(['name' => 'Plain', 'data' => ['site' => []]]);
        $plain->admit($owner, MixRole::Owner);
        $plain->admit($intruder, MixRole::Editor);
        $this->getJson("/api/collections/{$made['id']}?mix={$plain->id}")->assertNotFound();
    }

    public function test_collections_have_no_limits_on_free(): void
    {
        $me = User::factory()->create();
        $this->create($me);
        $this->create($me, ['slug' => 'team', 'name' => 'Team', 'entries' => $this->entries(100)]);
        $this->assertSame(2, $me->collections()->count());
    }

    public function test_the_payload_is_capped(): void
    {
        $me = User::factory()->create();
        $made = $this->create($me);
        $big = [['id' => 'e1', 'data' => ['body' => str_repeat('x', 2 * 1024 * 1024)]]];
        $this->save($made['id'], 1, ['entries' => $big])->assertStatus(413);
    }

    public function test_uploads_go_to_the_collection_and_count_toward_its_owner(): void
    {
        [$owner, $editor, $viewer, $stranger] = User::factory()->count(4)->create();
        $made = $this->create($owner);
        $id = $made['id'];
        $mix = $this->boundMix($owner, $editor);
        $mix->admit($viewer, MixRole::Viewer);
        $upload = fn (string $key, int $kb = 120, string $query = '') => $this->post("/api/collections/{$id}/assets{$query}", [
            'id' => $key, 'kind' => 'image', 'name' => 'cover.webp', 'mime' => 'image/webp', 'width' => 1200, 'height' => 800,
            'file' => UploadedFile::fake()->create($key, $kb, 'image/webp'),
        ], ['Accept' => 'application/json']);

        $this->actingAs($owner);
        $upload('img_ab12cd34')->assertCreated()->assertJsonPath('id', 'img_ab12cd34');
        Storage::disk('uploads-test')->assertExists("collections/{$id}/img_ab12cd34");
        $upload('../../etc/passwd')->assertUnprocessable();
        $this->assertSame(120 * 1024, $owner->usage()['uploads']);

        $this->actingAs($editor);
        $upload('img_ee12cd34', 120, "?mix={$mix->id}")->assertCreated();
        $this->assertSame(240 * 1024, $owner->usage()['uploads']);
        $this->assertSame(0, $editor->usage()['uploads']);

        $this->actingAs($viewer);
        $this->getJson("/api/collections/{$id}/assets?mix={$mix->id}")->assertOk()->assertJsonCount(2)->assertJsonPath('0.width', 1200);
        $this->get("/api/collections/{$id}/assets/img_ab12cd34?mix={$mix->id}")->assertOk()->assertHeader('Content-Type', 'image/webp');
        $upload('img_vv12cd34', 120, "?mix={$mix->id}")->assertForbidden();

        $this->actingAs($stranger)->get("/api/collections/{$id}/assets/img_ab12cd34")->assertNotFound();
        $this->get("/api/collections/{$id}/assets/img_ab12cd34?mix={$mix->id}")->assertNotFound();

        // The owner's room is shared with their mixes (Free's 100 MB, made 1 MB here).
        config(['blokmix.upload_mb.default' => 1]);
        $this->actingAs($editor);
        $upload('img_bg12cd34', 900, "?mix={$mix->id}")->assertForbidden()
            ->assertJsonPath('message', 'This collection’s owner is out of room for images and video. It stays in this browser.');

        // Deleting the collection takes its files with it.
        $this->actingAs($owner)->deleteJson("/api/collections/{$id}")->assertNoContent();
        Storage::disk('uploads-test')->assertMissing("collections/{$id}/img_ab12cd34");
    }
}
