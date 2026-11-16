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
use Mockery;
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
        $this->freezeTime();
        $res = $this->actingAs($this->owner)->publish()->assertOk()->assertJsonPath('publication.slug', 'fern-co')->assertJsonPath('publication.live', true);
        $code = $res->json('publication.code');
        $this->assertMatchesRegularExpression('#^'.Mix::SHORT_PATTERN.'$#', $code);
        $this->assertSame(['/', '/about'], $res->json('publication.pages'));
        $this->assertStringEndsWith("/{$code}/fern-co/", $res->json('publication.url'));
        $firstRelease = Publication::firstOrFail()->dir();
        Storage::disk('uploads-test')->assertExists("{$firstRelease}/index.html");

        $page = $this->get("{$this->host}/{$code}/fern-co/")->assertOk()->assertHeader('X-Robots-Tag', 'noindex, nofollow');
        $this->assertStringContainsString("frame-ancestors 'self'", $page->headers->get('Content-Security-Policy'));
        $this->assertSame([], $page->headers->getCookies(), 'blok.page never sets a cookie');
        $page->assertSee("href=\"/{$code}/fern-co/about\"", false);
        $this->get("{$this->host}/{$code}/fern-co/about")->assertOk()->assertSee('About us')->assertSee('Made with');
        $this->get("{$this->host}/{$code}/fern-co/media/hero1-b3.svg")->assertOk()->assertHeader('Content-Type', 'image/svg+xml')->assertDontSee('Made with');
        $this->get("{$this->host}/{$code}/fern-co/nope")->assertNotFound();

        // A rename keeps the code; the old name redirects.
        $this->publish(name: 'Fern Studio', files: ['index.html' => '<html><body>v2</body></html>'])->assertOk()->assertJsonPath('publication.code', $code);
        $secondRelease = Publication::firstOrFail()->dir();
        $this->get("{$this->host}/{$code}/fern-co/about")->assertRedirect("/{$code}/fern-studio/about");
        $this->get("{$this->host}/{$code}")->assertRedirect("/{$code}/fern-studio/");
        $newPage = $this->get("{$this->host}/{$code}/fern-studio/", ['If-None-Match' => $page->headers->get('ETag')])->assertOk()->assertSee('v2');
        $this->assertNotSame($page->headers->get('ETag'), $newPage->headers->get('ETag'));
        Storage::disk('uploads-test')->assertDirectoryEmpty($firstRelease);
        $this->get("{$this->host}/{$code}/fern-studio/about")->assertNotFound();

        $this->deleteJson(config('app.url')."/api/mixes/{$this->mix->id}/publication")->assertOk()->assertJsonPath('publication.live', false);
        $this->get("{$this->host}/{$code}/fern-studio/")->assertStatus(410);
        Storage::disk('uploads-test')->assertMissing("{$secondRelease}/index.html");
        // Publishing again brings back the same address.
        $this->publish()->assertOk()->assertJsonPath('publication.code', $code);
    }

    public function test_a_failed_republish_keeps_the_previous_release_live(): void
    {
        $this->actingAs($this->owner)->publish()->assertOk();
        $pub = Publication::firstOrFail();
        $disk = Storage::disk('uploads-test');
        $brokenDisk = Mockery::mock($disk);
        $stagedFile = null;
        $brokenDisk->shouldReceive('put')->twice()->andReturnUsing(function ($path, $data) use ($disk, &$stagedFile) {
            if ($stagedFile !== null) {
                return false;
            }
            $stagedFile = $path;

            return $disk->put($path, $data);
        });
        Storage::shouldReceive('disk')->with('uploads-test')->andReturn($brokenDisk, $disk);

        $this->publish(name: 'Replacement', files: ['index.html' => '<html><body>Replacement</body></html>', 'new.html' => 'new'])->assertInternalServerError();
        $this->assertSame($pub->release, $pub->fresh()->release);
        $this->get("{$this->host}/{$pub->code}/fern-co/")->assertOk()->assertSee('About');
        $this->get("{$this->host}/{$pub->code}/fern-co/about")->assertOk()->assertSee('About us');
        $disk->assertMissing($stagedFile);
    }

    public function test_an_existing_publication_without_a_release_still_works(): void
    {
        $this->actingAs($this->owner)->publish()->assertOk();
        $pub = Publication::firstOrFail();
        $disk = Storage::disk('uploads-test');
        $badge = '<a href="https://blokmix.com" target="_blank" rel="noopener" data-blokmix-badge style="position:fixed">Made with Blokmix</a>';
        $disk->put("published/{$pub->code}/index.html", '<html><body>About'.$badge.'</body></html>');
        $pub->update(['release' => null, 'badge' => false]);
        $oldEtag = '"'.md5($pub->published_at->getTimestamp().'|index.html').'"';
        $this->get("{$this->host}/{$pub->code}/fern-co/", ['If-None-Match' => $oldEtag])->assertOk()
            ->assertSee('About')->assertSee('Made with')->assertDontSee('data-blokmix-badge');

        $this->publish()->assertOk();
        $this->get("{$this->host}/{$pub->code}/fern-co/")->assertOk();
        $disk->assertMissing($pub->dir().'/index.html');
    }

    public function test_a_request_can_follow_a_release_switch_during_its_file_read(): void
    {
        $this->actingAs($this->owner)->publish()->assertOk();
        $pub = Publication::firstOrFail();
        $disk = Storage::disk('uploads-test');
        $switchingDisk = Mockery::mock($disk);
        $switchingDisk->shouldReceive('get')->with($pub->dir().'/index.html')->once()->andReturnUsing(function () use ($disk, $pub) {
            $previous = $pub->dir();
            $pub->release = '01k00000000000000000000000';
            $disk->put($pub->dir().'/index.html', '<html><body>New release</body></html>');
            $pub->save();
            $disk->deleteDirectory($previous);

            return null;
        });
        Storage::shouldReceive('disk')->with('uploads-test')->andReturn($switchingDisk, $disk);

        $this->get("{$this->host}/{$pub->code}/fern-co/")->assertOk()->assertSee('New release');
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

    public function test_paid_and_unpaid_sites_both_show_the_preview_notice(): void
    {
        $this->actingAs($this->owner)->publish()->assertOk()->assertJsonPath('publication.badge', true);
        $code = Publication::first()->code;
        $this->get("{$this->host}/{$code}/fern-co/")->assertOk()
            ->assertSee('<details data-blokmix-preview open>', false)
            ->assertSee('Made with <img src="/wordmark-ink.svg"', false)
            ->assertSee('Anyone with the link can view')
            ->assertSee('Search indexing disabled')
            ->assertSee('Form submissions disabled')
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow');
        $this->assertGreaterThan(0, $this->owner->usage()['uploads']);

        $this->mix->forceFill(['paid_at' => now()])->save();
        $this->publish()->assertOk()->assertJsonPath('publication.badge', true);
        $this->get("{$this->host}/{$code}/fern-co/")->assertOk()->assertSee('Made with');
        $path = Publication::where('code', $code)->firstOrFail()->dir().'/index.html';
        $this->assertStringNotContainsString('data-blokmix-preview', Storage::disk('uploads-test')->get($path));
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
