<?php

namespace Tests\Feature;

use App\Models\LibraryAsset;
use App\Models\LibrarySection;
use App\Models\LibrarySite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LibraryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        config(['blokmix.uploads_disk' => 'uploads-test', 'blokmix.owners' => ['owner@blokmix.test']]);
        Storage::fake('uploads-test');
    }

    private function owner(): User
    {
        return User::firstWhere('email', 'owner@blokmix.test') ?? User::factory()->create(['email' => 'owner@blokmix.test']);
    }

    private function siteJson(array $extra = []): array
    {
        return [
            'slug' => 'acme',
            'name' => 'Acme',
            'url' => 'https://acme.example',
            'industry' => 'SaaS',
            'tags' => ['minimal', 'dark'],
            'tokens' => ['color.bg' => '#0b0b0c', 'color.primary' => '#ff5a1f', 'font.display' => "'Inter', sans-serif", 'radius.base' => '8px'],
            'fonts' => [['family' => 'Inter', 'source' => 'google']],
            'thumb' => 'thumb.png',
            'pages' => [[
                'path' => '/',
                'title' => 'Home',
                'screenshot' => 'home.png',
                'width' => 1440,
                'height' => 3000,
                'sections' => [
                    ['order' => 0, 'type' => 'hero', 'box' => ['y' => 0, 'h' => 800], 'layoutId' => 'hero.layout-split', 'score' => 0.91, 'screenshot' => 'home-0.png'],
                    ['order' => 1, 'type' => 'features', 'box' => ['y' => 800, 'h' => 900], 'score' => 0.4],
                    ['order' => 2, 'type' => 'footer', 'box' => ['y' => 1700, 'h' => 300], 'status' => 'hidden'],
                ],
            ]],
            ...$extra,
        ];
    }

    private function upload(array $json, ?array $files = null): TestResponse
    {
        $files ??= ['thumb.png', 'home.png', 'home-0.png'];

        return $this->post('/api/library/sites', [
            'site' => UploadedFile::fake()->createWithContent('site.json', json_encode($json)),
            'files' => array_map(fn ($name) => UploadedFile::fake()->image($name, 20, 10), $files),
        ], ['Accept' => 'application/json']);
    }

    private function published(): LibrarySite
    {
        $this->actingAs($this->owner())->upload($this->siteJson())->assertCreated();
        $site = LibrarySite::firstWhere('slug', 'acme');
        $site->update(['status' => 'published']);

        return $site;
    }

    public function test_the_owner_uploads_a_bundle_as_a_draft(): void
    {
        $res = $this->actingAs($this->owner())->upload($this->siteJson())->assertCreated()
            ->assertJsonPath('slug', 'acme')
            ->assertJsonPath('status', 'draft')
            ->assertJsonPath('pages.0.sections.0.layoutId', 'hero.layout-split')
            ->assertJsonPath('pages.0.sections.0.status', 'matched')
            ->assertJsonPath('pages.0.sections.1.status', 'needs_layout')
            ->assertJsonCount(3, 'pages.0.sections');

        $this->assertSame(3, LibraryAsset::count());
        foreach (LibraryAsset::all() as $asset) {
            $this->assertMatchesRegularExpression('/^ls_[a-z0-9]{8}$/', $asset->id);
            $this->assertStringStartsWith('library/acme/', $asset->path);
            Storage::disk('uploads-test')->assertExists($asset->path);
        }
        $this->assertEqualsCanonicalizing(['thumb', 'full', 'section'], LibraryAsset::pluck('kind')->all());
        $this->assertStringStartsWith('/api/library/assets/ls_', $res->json('pages.0.screenshot'));
        // Library screenshots never count toward a plan.
        $this->assertSame(0, $this->owner()->usage()['uploads']);
    }

    public function test_a_gallery_section_uploads(): void
    {
        $json = $this->siteJson();
        $json['pages'][0]['sections'][1] = ['order' => 1, 'type' => 'gallery', 'box' => ['y' => 800, 'h' => 900], 'layoutId' => 'gallery.layout-grid'];
        $this->actingAs($this->owner())->upload($json)->assertCreated()
            ->assertJsonPath('pages.0.sections.1.type', 'gallery')
            ->assertJsonPath('pages.0.sections.1.status', 'matched');
    }

    public function test_detected_effects_upload_and_reach_the_board(): void
    {
        $json = $this->siteJson(['effects' => [
            'shadow' => ['params' => ['elevation' => 24, 'tint' => 'primary']],
            'gradient' => ['id' => 'gradient', 'params' => ['stops' => ['primary', 'accent'], 'angle' => 135]],
        ]]);
        $this->actingAs($this->owner())->upload($json)->assertCreated()
            ->assertJsonPath('effects.shadow', ['id' => 'shadow', 'params' => ['elevation' => 24, 'tint' => 'primary']])
            ->assertJsonPath('effects.gradient.params.stops', ['primary', 'accent']);
        LibrarySite::first()->update(['status' => 'published']);
        $this->getJson('/api/library')->assertJsonPath('0.effects', ['shadow', 'gradient']);

        // Only known effects, and dials that are plain values.
        $this->upload($this->siteJson(['effects' => ['sparkle' => ['params' => []]]]))->assertUnprocessable()->assertJsonValidationErrors(['site.effects']);
        $this->upload($this->siteJson(['effects' => ['glow' => ['params' => ['size' => ['a' => ['b' => 1]]]]]]))->assertUnprocessable()->assertJsonValidationErrors(['site.effects.glow.params.size']);
    }

    /** @param array<string, string> $entries name → bytes */
    private function zip(array $entries): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'bundle').'.zip';
        $zip = new \ZipArchive;
        $zip->open($path, \ZipArchive::CREATE);
        foreach ($entries as $name => $bytes) {
            $zip->addFromString($name, $bytes);
        }
        $zip->close();

        return new UploadedFile($path, 'bundle.zip', 'application/zip', null, true);
    }

    private function png(): string
    {
        $file = UploadedFile::fake()->image('x.png', 20, 10); // kept alive: its temp file goes with it

        return (string) file_get_contents($file->getRealPath());
    }

    public function test_a_long_page_uploads_as_one_zip(): void
    {
        // More screenshots than PHP takes as separate files in one request.
        $json = $this->siteJson();
        $json['pages'][0]['sections'] = array_map(fn ($i) => ['type' => 'features', 'box' => ['y' => $i * 100, 'h' => 100], 'screenshot' => "home-{$i}.png"], range(0, 24));
        $entries = ['thumb.png' => $this->png(), 'home.png' => $this->png()];
        foreach (range(0, 24) as $i) {
            $entries["home-{$i}.png"] = $this->png();
        }
        $this->actingAs($this->owner())->post('/api/library/sites', [
            'site' => UploadedFile::fake()->createWithContent('site.json', json_encode($json)),
            'bundle' => $this->zip($entries),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonCount(25, 'pages.0.sections');
        $this->assertSame(27, LibraryAsset::count());
    }

    public function test_a_zip_holds_only_flat_screenshot_names(): void
    {
        $this->actingAs($this->owner())->post('/api/library/sites', [
            'site' => UploadedFile::fake()->createWithContent('site.json', json_encode($this->siteJson())),
            'bundle' => $this->zip(['thumb.png' => $this->png(), 'home.png' => $this->png(), '../home-0.png' => $this->png()]),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('bundle');
        $this->assertSame(0, LibraryAsset::count());
    }

    public function test_only_owners_upload(): void
    {
        $this->actingAs(User::factory()->create())->upload($this->siteJson())->assertForbidden();
        $this->assertSame(0, LibrarySite::count());
        Storage::disk('uploads-test')->assertDirectoryEmpty('/');
    }

    public function test_bundles_are_checked(): void
    {
        $this->actingAs($this->owner());
        // A file site.json names is missing, and one it doesn't name is there.
        $this->upload($this->siteJson(), ['thumb.png', 'home.png', 'other.png'])->assertUnprocessable()->assertJsonValidationErrors(['files', 'extra']);
        // Shapes.
        $bad = $this->siteJson();
        $bad['pages'][0]['sections'][0]['type'] = 'carousel';
        $bad['pages'][0]['sections'][1]['box'] = ['y' => 0];
        $this->upload($bad)->assertUnprocessable()->assertJsonValidationErrors(['site.pages.0.sections.0.type', 'site.pages.0.sections.1.box.h']);
        $this->upload($this->siteJson(['slug' => '../etc']))->assertUnprocessable()->assertJsonValidationErrors(['site.slug']);
        // Only webp, png and jpeg.
        $this->post('/api/library/sites', [
            'site' => UploadedFile::fake()->createWithContent('site.json', json_encode($this->siteJson())),
            'files' => [UploadedFile::fake()->createWithContent('thumb.png', '<svg xmlns="http://www.w3.org/2000/svg"/>'), UploadedFile::fake()->image('home.png'), UploadedFile::fake()->image('home-0.png')],
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors(['files' => 'thumb.png isn’t a WebP, PNG or JPEG image.']);
        $this->assertSame(0, LibrarySite::count());
    }

    public function test_uploading_again_replaces_the_pages_and_files_but_keeps_curation(): void
    {
        $this->actingAs($this->owner())->upload($this->siteJson())->assertCreated();
        $site = LibrarySite::firstWhere('slug', 'acme');
        $site->update(['status' => 'published']);
        $oldPaths = LibraryAsset::pluck('path')->all();

        $next = $this->siteJson(['name' => 'Acme Inc', 'thumb' => null]);
        unset($next['industry']);
        $next['pages'][0]['sections'] = [['type' => 'hero', 'box' => ['y' => 0, 'h' => 700]]];
        $this->upload($next, ['home.png'])->assertOk()
            ->assertJsonPath('name', 'Acme Inc')
            ->assertJsonPath('industry', 'SaaS')
            ->assertJsonPath('status', 'published')
            ->assertJsonCount(1, 'pages.0.sections');

        $this->assertSame(1, LibrarySite::count());
        $this->assertSame(1, LibrarySection::count());
        $this->assertSame(1, LibraryAsset::count());
        foreach ($oldPaths as $path) {
            Storage::disk('uploads-test')->assertMissing($path);
        }
        Storage::disk('uploads-test')->assertExists(LibraryAsset::first()->path);
    }

    public function test_reading_needs_sign_in(): void
    {
        $this->published();
        auth()->logout();
        $asset = LibraryAsset::first();
        $this->getJson('/api/library')->assertUnauthorized();
        $this->getJson('/api/library/sites/acme')->assertUnauthorized();
        $this->getJson("/api/library/assets/{$asset->id}")->assertUnauthorized();
    }

    public function test_people_see_published_sites_without_hidden_sections(): void
    {
        $this->published();
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/library')->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.slug', 'acme')
            ->assertJsonPath('0.palette', ['color.bg' => '#0b0b0c', 'color.primary' => '#ff5a1f', 'font.display' => "'Inter', sans-serif"])
            ->assertJsonPath('0.pages', 1)
            ->assertJsonPath('0.sections', 2);
        $this->assertStringStartsWith('/api/library/assets/ls_', $this->getJson('/api/library')->json('0.thumb'));

        $this->getJson('/api/library/sites/acme')->assertOk()
            ->assertJsonCount(2, 'pages.0.sections')
            ->assertJsonMissing(['status' => 'hidden']);
        // The people who run Blokmix see hidden ones too.
        $this->actingAs($this->owner())->getJson('/api/library/sites/acme')->assertJsonCount(3, 'pages.0.sections');
    }

    public function test_drafts_are_only_for_owners(): void
    {
        $this->actingAs($this->owner())->upload($this->siteJson())->assertCreated();
        $asset = LibraryAsset::first();

        $this->actingAs(User::factory()->create());
        $this->getJson('/api/library')->assertOk()->assertJsonCount(0);
        $this->getJson('/api/library?drafts=1')->assertOk()->assertJsonCount(0);
        $this->getJson('/api/library/sites/acme')->assertNotFound();
        $this->get("/api/library/assets/{$asset->id}")->assertNotFound();

        $this->actingAs($this->owner());
        $this->getJson('/api/library')->assertJsonCount(0);
        $this->getJson('/api/library?drafts=1')->assertJsonCount(1)->assertJsonPath('0.status', 'draft');
        $this->getJson('/api/library/sites/acme')->assertOk();
        $this->get("/api/library/assets/{$asset->id}")->assertOk()->assertHeader('Cache-Control', 'immutable, max-age=31536000, private');
    }

    public function test_screenshots_stream_to_anyone_signed_in_once_published(): void
    {
        $this->published();
        $asset = LibraryAsset::where('kind', 'full')->first();
        $res = $this->actingAs(User::factory()->create())->get("/api/library/assets/{$asset->id}")->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');
        $this->assertSame(Storage::disk('uploads-test')->get($asset->path), $res->streamedContent());
        $this->get('/api/library/assets/ls_zzzzzzzz')->assertNotFound();
    }

    public function test_owners_curate_sites_and_sections(): void
    {
        $site = $this->published();
        $hero = LibrarySection::where('type', 'hero')->first();
        $features = LibrarySection::where('type', 'features')->first();

        $this->patchJson('/api/library/sites/acme', ['industry' => 'Fintech', 'tags' => ['bold'], 'status' => 'draft', 'name' => 'Acme Co'])->assertOk()
            ->assertJsonPath('industry', 'Fintech')->assertJsonPath('tags', ['bold'])->assertJsonPath('status', 'draft');
        $this->patchJson('/api/library/sites/acme', ['status' => 'live'])->assertUnprocessable();

        // A layout matches a section; taking it away leaves it needing one.
        $this->patchJson("/api/library/sections/{$features->id}", ['layout_id' => 'features.layout-grid'])->assertOk()
            ->assertJsonPath('layoutId', 'features.layout-grid')->assertJsonPath('status', 'matched');
        $this->patchJson("/api/library/sections/{$hero->id}", ['layout_id' => null])->assertOk()->assertJsonPath('status', 'needs_layout');
        $this->patchJson("/api/library/sections/{$hero->id}", ['status' => 'hidden', 'type' => 'header'])->assertOk()
            ->assertJsonPath('status', 'hidden')->assertJsonPath('type', 'header');
        $this->patchJson("/api/library/sections/{$hero->id}", ['layout_id' => 'Hero/../x'])->assertUnprocessable();
        $this->patchJson("/api/library/sections/{$hero->id}", ['type' => 'carousel'])->assertUnprocessable();
    }

    public function test_only_owners_curate_or_take_down(): void
    {
        $this->published();
        $section = LibrarySection::first();
        $this->actingAs(User::factory()->create());
        $this->patchJson('/api/library/sites/acme', ['status' => 'draft'])->assertForbidden();
        $this->patchJson("/api/library/sections/{$section->id}", ['status' => 'hidden'])->assertForbidden();
        $this->deleteJson('/api/library/sites/acme')->assertForbidden();
        $this->assertSame('published', LibrarySite::first()->status);
    }

    public function test_taking_a_site_down_removes_its_files(): void
    {
        $this->published();
        $paths = LibraryAsset::pluck('path')->all();
        $this->actingAs($this->owner())->deleteJson('/api/library/sites/acme')->assertNoContent();
        $this->assertSame(0, LibrarySite::count() + LibraryAsset::count() + LibrarySection::count());
        foreach ($paths as $path) {
            Storage::disk('uploads-test')->assertMissing($path);
        }
        $this->deleteJson('/api/library/sites/acme')->assertNotFound();
    }

    public function test_the_admin_page_is_for_owners_only(): void
    {
        $this->published();
        $this->actingAs($this->owner())->get('/library/admin')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('library/admin')
            ->has('sites', 1)
            ->where('sites.0.matched', 1)
            ->where('sites.0.needsLayout', 1)
            ->where('site', null));
        $this->get('/library/admin/acme')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('site.slug', 'acme')
            ->has('site.pages.0.sections', 3));
        $this->get('/library/admin/nope')->assertNotFound();

        $this->actingAs(User::factory()->create())->get('/library/admin')->assertNotFound();
        $this->get('/library/admin/acme')->assertNotFound();
        auth()->logout();
        $this->get('/library/admin')->assertRedirect('/login');
    }
}
