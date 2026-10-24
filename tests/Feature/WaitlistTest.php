<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class WaitlistTest extends TestCase
{
    use RefreshDatabase;

    public function test_joining_saves_the_email_once(): void
    {
        $this->postJson('/api/waitlist', ['email' => ' Pat@Example.com ', 'source' => 'hero'])->assertOk()->assertJson(['joined' => true]);
        $this->postJson('/api/waitlist', ['email' => 'pat@example.com', 'source' => 'closing'])->assertOk();

        $this->assertSame(1, DB::table('waitlist')->count());
        $this->assertDatabaseHas('waitlist', ['email' => 'pat@example.com', 'source' => 'hero']);
    }

    public function test_a_plain_form_post_comes_back_to_the_site(): void
    {
        $this->post('/api/waitlist', ['email' => 'sam@example.com'])->assertRedirect('/?joined=1#waitlist');
    }

    public function test_a_bad_email_is_refused(): void
    {
        $this->postJson('/api/waitlist', ['email' => 'not an email'])->assertUnprocessable();
        $this->assertSame(0, DB::table('waitlist')->count());
    }

    public function test_the_hidden_field_quietly_drops_bots(): void
    {
        $this->postJson('/api/waitlist', ['email' => 'bot@example.com', 'website' => 'http://spam'])->assertOk();
        $this->assertSame(0, DB::table('waitlist')->count());
    }
}
