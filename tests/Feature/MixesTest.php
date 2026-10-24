<?php

namespace Tests\Feature;

use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MixesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_the_home_page_opens_the_mix_in_this_browser(): void
    {
        $this->get('/')->assertRedirect('/mixes/local');
    }

    public function test_mixes_lists_none_saved_yet(): void
    {
        $this->get('/mixes')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('mixes/index')->has('mixes', 0)->where('name', 'Blokmix'));
    }

    public function test_the_local_mix_opens_on_the_board(): void
    {
        $this->get('/mixes/local')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('mixes/show')->where('mix.id', 'local'));
    }

    public function test_other_mixes_do_not_exist_yet(): void
    {
        $this->get('/mixes/abc')->assertNotFound();
    }
}
