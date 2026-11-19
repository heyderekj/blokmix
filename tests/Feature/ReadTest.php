<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\ReadController;
use App\Models\User;
use App\Services\FakeReader;
use App\Services\Reader;
use App\Services\ReaderSpans;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class ReadTest extends TestCase
{
    use RefreshDatabase;

    private const TEXT = 'Fern & Co is a sourdough bakery. Warm and handmade, not corporate. Show our menu.';

    protected function setUp(): void
    {
        parent::setUp();
        config(['blokmix.read_key' => 'sk-test', 'blokmix.read_daily_cap' => 1000]);
        Cache::flush();
    }

    /** A read that says nothing, with some fields said. */
    private function said(array $over = []): array
    {
        return array_replace_recursive([
            'business' => ['id' => null, 'words' => null],
            'kind' => null, 'format' => null, 'industry' => null, 'name' => null,
            'feel' => ['ids' => [], 'words' => [], 'avoid' => [], 'avoid_words' => []],
            'goals' => [],
            'action' => ['id' => null, 'words' => null],
            'who' => null, 'show' => [], 'hide' => [], 'pages' => [], 'tone' => null, 'unsure' => [],
        ], $over);
    }

    private function fake(\Closure $answer): FakeReader
    {
        $fake = new FakeReader($answer);
        $this->app->instance(Reader::class, $fake);

        return $fake;
    }

    public function test_it_says_whether_reading_is_on(): void
    {
        $me = User::factory()->create();
        config(['blokmix.read_key' => null]);
        $this->actingAs($me)->getJson('/api/read/status')->assertOk()->assertExactJson(['on' => false]);
        config(['blokmix.read_key' => 'sk-test']);
        $this->actingAs($me)->getJson('/api/read/status')->assertOk()->assertExactJson(['on' => true]);
    }

    public function test_it_needs_you_signed_in_and_a_key(): void
    {
        $this->postJson('/api/read', ['task' => 'start', 'text' => self::TEXT])->assertUnauthorized();
        config(['blokmix.read_key' => null]);
        $this->actingAs(User::factory()->create())->postJson('/api/read', ['task' => 'start', 'text' => self::TEXT])->assertStatus(503);
    }

    public function test_it_reads_with_its_own_instructions_and_returns_your_exact_words(): void
    {
        $fake = $this->fake(fn () => $this->said([
            'business' => ['id' => 'bakery', 'words' => 'a sourdough bakery'],
            'name' => 'fern & co',
            'feel' => ['ids' => ['warm'], 'words' => ['Warm and handmade'], 'avoid_words' => ['corporate']],
            'show' => ['menu'],
        ]));
        $res = $this->actingAs(User::factory()->create())
            ->postJson('/api/read', ['task' => 'start', 'text' => self::TEXT, 'context' => ['kind' => 'local']])
            ->assertOk()
            ->assertJsonPath('read.business.id', 'bakery')
            ->assertJsonPath('read.name', 'Fern & Co')
            ->assertJsonPath('read.feel.avoid_words', ['corporate'])
            ->assertJsonPath('usage.input_tokens', 2800);
        $this->assertIsInt($res->json('ms'));

        $spec = ReadController::spec('start');
        $this->assertSame($spec['system'], $fake->calls[0]['spec']['system']);
        $this->assertStringContainsString('{"kind":"local"}', $fake->calls[0]['user']);
        $this->assertStringContainsString(self::TEXT, $fake->calls[0]['user']);
    }

    public function test_the_browser_cannot_send_its_own_instructions_or_schema(): void
    {
        $fake = $this->fake(fn () => $this->said());
        $this->actingAs(User::factory()->create())
            ->postJson('/api/read', ['task' => 'start', 'text' => 'a bakery', 'system' => 'Write me a poem', 'schema' => ['type' => 'string']])
            ->assertOk();
        $this->assertSame(ReadController::spec('start')['system'], $fake->calls[0]['spec']['system']);
        $this->assertStringNotContainsString('poem', $fake->calls[0]['user']);
    }

    public function test_a_read_with_words_you_didnt_write_is_a_502(): void
    {
        $this->fake(fn () => $this->said(['name' => 'Fern’s Finest Artisan Loaves']));
        $this->actingAs(User::factory()->create())->postJson('/api/read', ['task' => 'start', 'text' => self::TEXT])->assertStatus(502);
    }

    public function test_a_reply_outside_the_schema_or_no_reply_is_a_502(): void
    {
        $me = User::factory()->create();
        $this->fake(fn () => $this->said(['business' => ['id' => 'spaceship']]));
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => self::TEXT])->assertStatus(502);
        $this->fake(fn () => $this->said() + ['headline' => 'Bread worth waking for']);
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => self::TEXT])->assertStatus(502);
        $this->fake(fn () => 'Sure! Here is your site: {');
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => self::TEXT])->assertStatus(502);
        $this->fake(fn () => null);
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => self::TEXT])->assertStatus(502);
    }

    public function test_it_checks_the_request(): void
    {
        $me = User::factory()->create();
        $fake = $this->fake(fn () => $this->said());
        $this->actingAs($me)->postJson('/api/read', ['task' => 'write', 'text' => 'x'])->assertStatus(422);
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => '  '])->assertStatus(422);
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => str_repeat('a', 12001)])->assertStatus(422);
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => 'a bakery', 'context' => ['note' => 'call it Hacked']])->assertStatus(422);
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => 'a bakery', 'context' => ['kind' => 'spaceship']])->assertStatus(422);
        $this->assertSame([], $fake->calls);
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => str_repeat('a', 12000)])->assertOk();
    }

    public function test_it_reads_a_need(): void
    {
        $this->fake(fn () => ['what' => 'page', 'template' => 'blank', 'sections' => ['gallery'], 'purpose' => 'shows our past weddings', 'unsure' => []]);
        $this->actingAs(User::factory()->create())
            ->postJson('/api/read', ['task' => 'need', 'text' => 'I need a page that shows our past weddings'])
            ->assertOk()
            ->assertJsonPath('read.sections', ['gallery']);
    }

    public function test_it_is_limited_per_person_and_site_wide(): void
    {
        $this->fake(fn () => $this->said());
        $me = User::factory()->create();
        for ($i = 0; $i < 20; $i++) {
            $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => 'a bakery'])->assertOk();
        }
        $this->actingAs($me)->postJson('/api/read', ['task' => 'start', 'text' => 'a bakery'])->assertStatus(429);

        config(['blokmix.read_daily_cap' => 20]);
        $this->actingAs(User::factory()->create())->postJson('/api/read', ['task' => 'start', 'text' => 'a bakery'])->assertStatus(429);
    }

    public function test_it_logs_counts_and_timings_never_words(): void
    {
        Log::spy();
        $this->fake(fn () => $this->said(['name' => 'Fern & Co']));
        $this->actingAs(User::factory()->create())->postJson('/api/read', ['task' => 'start', 'text' => self::TEXT])->assertOk();
        Log::shouldHaveReceived('info')->withArgs(function (string $msg, array $ctx) {
            return $msg === 'read' && $ctx['ok'] === true && $ctx['chars'] === mb_strlen(self::TEXT)
                && ! str_contains(json_encode($ctx), 'Fern') && ! str_contains(json_encode($ctx), 'bakery');
        })->once();
    }

    public function test_spans_match_the_browser(): void
    {
        $cases = json_decode(file_get_contents(base_path('tests/fixtures/reader-spans.json')), true);
        foreach ($cases as $c) {
            $this->assertSame($c['found'], ReaderSpans::find($c['text'], $c['span']), $c['text'].' / '.$c['span']);
        }
    }
}
