<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PasswordTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_it_is_open_locally_without_a_password(): void
    {
        config(['blokmix.password' => null]);
        $this->get('/mixes')->assertOk();
    }

    public function test_production_stays_closed_until_a_password_is_set(): void
    {
        config(['blokmix.password' => null]);
        $this->app->detectEnvironment(fn () => 'production');
        $this->get('/mixes')->assertStatus(503);
        $this->get('/up')->assertOk();
    }

    public function test_with_a_password_pages_ask_for_it_and_the_api_refuses(): void
    {
        config(['blokmix.password' => 'open sesame']);
        $this->get('/mixes/local')->assertRedirect('/unlock');
        $this->get('/unlock')->assertOk()->assertInertia(fn (Assert $page) => $page->component('unlock'));
        $this->putJson('/api/mixes/x', [])->assertUnauthorized();
    }

    public function test_the_right_password_opens_it_and_goes_where_you_were_headed(): void
    {
        config(['blokmix.password' => 'open sesame']);
        $this->get('/mixes/local');
        $this->post('/unlock', ['password' => 'wrong'])->assertSessionHasErrors('password');
        $this->post('/unlock', ['password' => 'open sesame'])->assertRedirect('/mixes/local');
        $this->get('/mixes')->assertOk();
    }

    public function test_changing_the_password_locks_everyone_out_again(): void
    {
        config(['blokmix.password' => 'open sesame']);
        $this->post('/unlock', ['password' => 'open sesame']);
        config(['blokmix.password' => 'new one']);
        $this->get('/mixes')->assertRedirect('/unlock');
    }

    public function test_guessing_is_slowed_down(): void
    {
        config(['blokmix.password' => 'open sesame']);
        foreach (range(1, 6) as $_) {
            $this->post('/unlock', ['password' => 'guess']);
        }
        $this->post('/unlock', ['password' => 'guess'])->assertStatus(429);
    }
}
