<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WaitlistPageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        config(['blokmix.owners' => ['owner@blokmix.test']]);
        DB::table('waitlist')->insert([
            ['email' => 'pat@example.com', 'source' => 'hero', 'created_at' => now()->subDay(), 'updated_at' => now()],
            ['email' => 'sam@example.com', 'source' => 'closing', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    private function owner(): User
    {
        return User::factory()->create(['email' => 'Owner@blokmix.test']);
    }

    public function test_the_owner_sees_everyone_newest_first(): void
    {
        $this->actingAs($this->owner())->get('/waitlist')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('waitlist/index')
            ->has('people', 2)
            ->where('people.0.email', 'sam@example.com')
            ->where('auth.owner', true));
    }

    public function test_anyone_else_gets_a_404(): void
    {
        $someone = User::factory()->create();
        $this->actingAs($someone)->get('/waitlist')->assertNotFound();
        $this->actingAs($someone)->get('/waitlist/export')->assertNotFound();
        $this->actingAs($someone)->delete('/waitlist/1')->assertNotFound();
        $this->actingAs($someone)->get('/')->assertInertia(fn (Assert $page) => $page->where('auth.owner', false));
    }

    public function test_signed_out_people_are_sent_to_sign_in(): void
    {
        $this->get('/waitlist')->assertRedirect('/login');
    }

    public function test_the_csv_has_everyone_oldest_first(): void
    {
        $res = $this->actingAs($this->owner())->get('/waitlist/export')->assertOk();
        $lines = array_values(array_filter(explode("\n", $res->streamedContent())));
        $this->assertSame('email,source,joined', $lines[0]);
        $this->assertStringStartsWith('pat@example.com,hero,', $lines[1]);
        $this->assertCount(3, $lines);
    }

    public function test_the_owner_can_take_someone_off(): void
    {
        $id = DB::table('waitlist')->where('email', 'pat@example.com')->value('id');
        $this->actingAs($this->owner())->delete("/waitlist/{$id}")->assertRedirect('/waitlist');
        $this->assertDatabaseMissing('waitlist', ['email' => 'pat@example.com']);
    }
}
