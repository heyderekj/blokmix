<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
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

    public function test_with_a_password_it_asks_for_it(): void
    {
        config(['blokmix.password' => 'open sesame']);
        $this->get('/mixes')->assertUnauthorized()->assertHeader('WWW-Authenticate');
        $this->get('/mixes', ['Authorization' => 'Basic '.base64_encode('anyone:wrong')])->assertUnauthorized();
        $this->get('/mixes', ['Authorization' => 'Basic '.base64_encode('anyone:open sesame')])->assertOk();
        $this->putJson('/api/mixes/x', [])->assertUnauthorized();
    }
}
