<?php

namespace Tests\Feature;

use App\Providers\AppServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class ProductionUrlsTest extends TestCase
{
    public function test_production_uses_the_public_origin_for_app_links(): void
    {
        $this->app->instance('env', 'production');
        config(['blokmix.home_url' => 'https://blokmix.com']);
        $this->app->getProvider(AppServiceProvider::class)->boot();

        URL::setRequest(Request::create('https://upstream.example.com/'));

        $this->assertSame('https://blokmix.com/share/invite-token', route('share.join', 'invite-token'));
        $this->assertSame('https://blokmix.com/login', url('/login'));
        $this->assertSame('https://'.config('blokmix.publish_host'), route('published.home'));
    }
}
