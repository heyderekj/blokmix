<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AssetsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Mix $mix;

    protected function setUp(): void
    {
        parent::setUp();
        config(['blokmix.uploads_disk' => 'uploads-test']);
        Storage::fake('uploads-test');
        $this->owner = User::factory()->create();
        $this->mix = Mix::create(['name' => 'Launch']);
        $this->mix->admit($this->owner, MixRole::Owner);
    }

    private function upload(array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->post("/api/mixes/{$this->mix->id}/assets", [
            'id' => 'img_ab12cd34', 'kind' => 'image', 'name' => 'hero.webp', 'mime' => 'image/webp', 'width' => 1600, 'height' => 900,
            'file' => UploadedFile::fake()->create('img_ab12cd34', 120, 'image/webp'),
            ...$extra,
        ], ['Accept' => 'application/json']);
    }

    public function test_editors_upload_and_members_download(): void
    {
        $this->actingAs($this->owner)->upload()->assertCreated()->assertJsonPath('id', 'img_ab12cd34');
        Storage::disk('uploads-test')->assertExists("mixes/{$this->mix->id}/img_ab12cd34");

        $viewer = User::factory()->create();
        $this->mix->admit($viewer, MixRole::Viewer);
        $this->actingAs($viewer)->getJson("/api/mixes/{$this->mix->id}/assets")->assertOk()->assertJsonPath('0.width', 1600);
        $this->get("/api/mixes/{$this->mix->id}/assets/img_ab12cd34")->assertOk()->assertHeader('Content-Type', 'image/webp');
        $this->upload(['id' => 'img_zz99yy88'])->assertForbidden();
    }

    public function test_strangers_see_nothing_and_ids_are_checked(): void
    {
        $this->actingAs($this->owner)->upload(['id' => '../../etc/passwd'])->assertUnprocessable();
        $this->upload()->assertCreated();
        $this->actingAs(User::factory()->create())->get("/api/mixes/{$this->mix->id}/assets/img_ab12cd34")->assertNotFound();
    }

    public function test_unsplash_goes_through_the_server(): void
    {
        $this->actingAs($this->owner);
        config(['blokmix.unsplash_key' => null]);
        $this->getJson('/api/unsplash/search?query=desk')->assertStatus(503);

        config(['blokmix.unsplash_key' => 'server-key']);
        Http::fake(['api.unsplash.com/*' => Http::response(['results' => [['id' => 'p1']]])]);
        $this->getJson('/api/unsplash/search?query=desk&orientation=landscape')->assertOk()->assertJsonPath('results.0.id', 'p1');
        Http::assertSent(fn ($r) => $r->hasHeader('Authorization', 'Client-ID server-key') && str_contains($r->url(), 'query=desk'));

        $this->postJson('/api/unsplash/download', ['url' => 'https://evil.example/steal'])->assertUnprocessable();
        $this->postJson('/api/unsplash/download', ['url' => 'https://api.unsplash.com/photos/p1/download'])->assertNoContent();
    }
}
