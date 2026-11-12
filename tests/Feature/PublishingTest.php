<?php

namespace Tests\Feature;

use App\Enums\MixRole;
use App\Http\Controllers\Api\PublicationController;
use App\Models\Mix;
use App\Models\Publication;
use App\Models\User;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\Exception\S3Exception;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
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

    private function publish(?Mix $mix = null, array $files = [], string $name = 'Fern & Co'): TestResponse
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

    public function test_an_unpaid_site_publishes_with_a_badge_and_files_count(): void
    {
        $this->actingAs($this->owner)->publish()->assertOk()->assertJsonPath('publication.badge', true);
        $code = Publication::first()->code;
        $this->get("{$this->host}/{$code}/fern-co/")->assertSee('Made with Blokmix');
        $this->assertGreaterThan(0, $this->owner->usage()['uploads']);

        $other = Mix::create(['name' => 'Second']);
        $other->admit($this->owner, MixRole::Owner);
        $this->publish($other)->assertOk()->assertJsonPath('publication.badge', true);

        // Paid for: no badge on that site (the next publish drops it); the owner's other site keeps its own.
        $this->mix->forceFill(['paid_at' => now()])->save();
        $this->publish()->assertOk()->assertJsonPath('publication.badge', false);
        $this->assertStringNotContainsString('Made with Blokmix', Storage::disk('uploads-test')->get("published/{$code}/index.html"));
        $this->publish($other)->assertOk()->assertJsonPath('publication.badge', true);

        // Plus from before: no badge on any of the owner's sites.
        $this->owner->forceFill(['plan' => 'plus'])->save();
        $this->publish($other)->assertOk()->assertJsonPath('publication.badge', false);
    }

    public function test_published_routes_answer_only_on_the_publish_host(): void
    {
        $this->actingAs($this->owner)->publish()->assertOk();
        $code = Publication::first()->code;
        // On blokmix.com the code is a mix address (signed in, not this mix): never the published page.
        $this->get(config('app.url')."/{$code}/fern-co/")->assertNotFound();
        // The app's own pages don't answer on blok.page.
        $this->get("{$this->host}/login")->assertNotFound();
        $this->get("{$this->host}/")->assertRedirect(config('blokmix.home_url'));
        // Even when APP_URL is the publish host (Laravel Cloud can make a custom domain primary), home leads to Blokmix.
        config(['app.url' => $this->host, 'blokmix.home_url' => 'https://blokmix.com']);
        $this->get("{$this->host}/")->assertRedirect('https://blokmix.com');
    }

    public function test_files_go_up_to_a_bucket_together(): void
    {
        $mock = new MockHandler;
        $files = [];
        for ($i = 1; $i <= 40; $i++) {
            $files["media/p{$i}.svg"] = '<svg/>';
            $mock->append(new Result([]));
        }
        $files['index.html'] = '<html></html>';
        $mock->append(new Result([]));
        $disk = Storage::build([
            'driver' => 's3', 'key' => 'k', 'secret' => 's', 'region' => 'auto', 'bucket' => 'blokmix-test',
            'endpoint' => 'https://r2.example.test', 'root' => 'app', 'handler' => $mock,
        ]);

        PublicationController::putAll($disk, 'published/k3x9', $files);

        $this->assertSame(0, $mock->count(), 'every file was put');
        $last = $mock->getLastCommand();
        $this->assertSame('PutObject', $last->getName());
        $this->assertSame('blokmix-test', $last['Bucket']);
        $this->assertMatchesRegularExpression('#^app/published/k3x9/(index\.html|media/p\d+\.svg)$#', $last['Key']);
        $this->assertContains($last['ContentType'], ['text/html; charset=utf-8', 'image/svg+xml']);
    }

    public function test_a_failed_put_fails_the_publish(): void
    {
        $mock = new MockHandler([
            new Result([]),
            fn ($cmd) => new S3Exception('Nope', $cmd),
        ]);
        $disk = Storage::build(['driver' => 's3', 'key' => 'k', 'secret' => 's', 'region' => 'auto', 'bucket' => 'b', 'handler' => $mock]);

        $this->expectException(S3Exception::class);
        PublicationController::putAll($disk, 'published/k3x9', ['index.html' => 'x', 'about.html' => 'y']);
    }
}
