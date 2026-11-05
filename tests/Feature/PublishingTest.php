<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\Publication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublishingTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Mix $mix;

    private string $host;

    protected function setUp(): void
    {
        parent::setUp();
        config(['blokmix.uploads_disk' => 'uploads-test', 'blokmix.owners' => ['runs@blokmix.test']]);
        Storage::fake('uploads-test');
        $this->host = 'https://'.config('blokmix.publish_host');
        $this->owner = User::factory()->create();
        $this->mix = Mix::create(['name' => 'Launch']);
        $this->mix->admit($this->owner, MixRole::Owner);
    }

    /** @param array<string, string> $files */
    private function bundle(array $files): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'pub').'.zip';
        $zip = new \ZipArchive;
        $zip->open($path, \ZipArchive::CREATE);
        foreach ($files as $name => $data) {
            $zip->addFromString($name, $data);
        }
        $zip->close();

        return new UploadedFile($path, 'bundle.zip', 'application/zip', null, true);
    }

    private function publish(?Mix $mix = null, array $files = [], string $name = 'Fern & Co'): \Illuminate\Testing\TestResponse
    {
        $mix ??= $this->mix;
        $files = $files ?: [
            'index.html' => '<!doctype html><html><body><a href="/__blokmix_base__/about">About</a></body></html>',
            'about.html' => '<!doctype html><html><body>About us</body></html>',
            'media/hero1-b3.svg' => '<svg xmlns="http://www.w3.org/2000/svg"/>',
        ];

        return $this->post(config('app.url')."/api/mixes/{$mix->id}/publication", ['name' => $name, 'bundle' => $this->bundle($files)], ['Accept' => 'application/json']);
    }

    public function test_publish_serve_republish_and_unpublish(): void
    {
        $res = $this->actingAs($this->owner)->publish()->assertOk()->assertJsonPath('publication.slug', 'fern-co')->assertJsonPath('publication.live', true);
        $code = $res->json('publication.code');
        $this->assertMatchesRegularExpression('#^'.Mix::SHORT_PATTERN.'$#', $code);
        $this->assertSame(['/', '/about'], $res->json('publication.pages'));
        $this->assertStringEndsWith("/{$code}/fern-co/", $res->json('publication.url'));
        Storage::disk('uploads-test')->assertExists("published/{$code}/index.html");

        $page = $this->get("{$this->host}/{$code}/fern-co/")->assertOk()->assertHeader('X-Robots-Tag', 'noindex, nofollow');
        $this->assertStringContainsString("frame-ancestors 'self'", $page->headers->get('Content-Security-Policy'));
        $this->assertSame([], $page->headers->getCookies(), 'blok.page never sets a cookie');
        $page->assertSee("href=\"/{$code}/fern-co/about\"", false);
        $this->get("{$this->host}/{$code}/fern-co/about")->assertOk()->assertSee('About us');
        $this->get("{$this->host}/{$code}/fern-co/media/hero1-b3.svg")->assertOk()->assertHeader('Content-Type', 'image/svg+xml');
        $this->get("{$this->host}/{$code}/fern-co/nope")->assertNotFound();

        // A rename keeps the code; the old name redirects.
        $this->publish(name: 'Fern Studio', files: ['index.html' => '<html><body>v2</body></html>'])->assertOk()->assertJsonPath('publication.code', $code);
        $this->get("{$this->host}/{$code}/fern-co/about")->assertRedirect("/{$code}/fern-studio/about");
        $this->get("{$this->host}/{$code}")->assertRedirect("/{$code}/fern-studio/");
        $this->get("{$this->host}/{$code}/fern-studio/")->assertSee('v2');
        Storage::disk('uploads-test')->assertMissing("published/{$code}/about.html");

        $this->deleteJson(config('app.url')."/api/mixes/{$this->mix->id}/publication")->assertOk()->assertJsonPath('publication.live', false);
        $this->get("{$this->host}/{$code}/fern-studio/")->assertStatus(410);
        Storage::disk('uploads-test')->assertMissing("published/{$code}/index.html");
        // Publishing again brings back the same address.
        $this->publish()->assertOk()->assertJsonPath('publication.code', $code);
    }

    public function test_viewers_and_strangers_cant_publish(): void
    {
        $viewer = User::factory()->create();
        $this->mix->admit($viewer, MixRole::Viewer);
        $this->actingAs($viewer)->publish()->assertForbidden();
        $this->getJson(config('app.url')."/api/mixes/{$this->mix->id}/publication")->assertOk()->assertJsonPath('publication', null);
        $this->actingAs(User::factory()->create())->publish()->assertNotFound();
    }

    public function test_only_pages_and_media_get_in(): void
    {
        $this->actingAs($this->owner);
        $this->publish(files: ['index.html' => 'x', '../evil.html' => 'x'])->assertUnprocessable();
        $this->publish(files: ['index.html' => 'x', 'run.php' => 'x'])->assertUnprocessable();
        $this->publish(files: ['index.html' => 'x', '.htaccess' => 'x'])->assertUnprocessable();
        $this->publish(files: ['about.html' => 'x'])->assertUnprocessable();
    }

    public function test_free_has_one_publication_with_a_badge_and_files_count(): void
    {
        $this->actingAs($this->owner)->publish()->assertOk()->assertJsonPath('publication.badge', true);
        $code = Publication::first()->code;
        $this->get("{$this->host}/{$code}/fern-co/")->assertSee('Made with Blokmix');
        $this->assertGreaterThan(0, $this->owner->usage()['uploads']);

        $other = Mix::create(['name' => 'Second']);
        $other->admit($this->owner, MixRole::Owner);
        $this->publish($other)->assertForbidden();

        // A mix pack: as many as you like, no badge.
        $this->owner->forceFill(['mix_packs' => 1])->save();
        $this->publish($other)->assertOk()->assertJsonPath('publication.badge', false);
        $this->publish()->assertOk();
        $this->assertStringNotContainsString('Made with Blokmix', Storage::disk('uploads-test')->get("published/{$code}/index.html"));
    }

    public function test_published_routes_answer_only_on_the_publish_host(): void
    {
        $this->actingAs($this->owner)->publish()->assertOk();
        $code = Publication::first()->code;
        // On blokmix.com the code is a mix address (signed in, not this mix): never the published page.
        $this->get(config('app.url')."/{$code}/fern-co/")->assertNotFound();
        // The app's own pages don't answer on blok.page.
        $this->get("{$this->host}/login")->assertNotFound();
        $this->get("{$this->host}/")->assertRedirect();
    }
}
