<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/** Every route the app answers must be one the edge in front of blokmix.com sends here (docs/edge-paths.json). */
class EdgePathsTest extends TestCase
{
    public function test_every_route_is_sent_to_the_app(): void
    {
        $edge = json_decode(file_get_contents(base_path('docs/edge-paths.json')), true);
        $missing = [];
        foreach (Route::getRoutes() as $route) {
            $path = '/'.ltrim($route->uri(), '/');
            if ($path === '/') {
                continue; // The edge sends / here when the signed-in cookie is set.
            }
            $covered = collect($edge['prefixes'])->contains(fn ($p) => $path === $p || str_starts_with($path, $p.'/'));
            if (! $covered) {
                $missing[] = $path;
            }
        }
        $this->assertSame([], array_values(array_unique($missing)), 'Add these to docs/edge-paths.json and the blokmix.com Worker');
    }

    public function test_the_cookie_is_the_one_marked_while_signed_in(): void
    {
        $edge = json_decode(file_get_contents(base_path('docs/edge-paths.json')), true);
        $this->assertSame(\App\Http\Middleware\MarkSignedIn::COOKIE, $edge['cookie']);
    }
}
