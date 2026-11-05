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
            if ($route->getDomain()) {
                continue; // blok.page isn't behind blokmix.com's edge.
            }
            $path = '/'.ltrim($route->uri(), '/');
            if ($path === '/') {
                continue; // The edge sends / here when the signed-in cookie is set.
            }
            // A mix's short address is a whole path, matched by a pattern rather than a prefix.
            $sample = $path === '/{mix}' ? '/k3x9' : $path;
            $covered = collect($edge['prefixes'])->contains(fn ($p) => $sample === $p || str_starts_with($sample, $p.'/'))
                || collect($edge['patterns'] ?? [])->contains(fn ($re) => preg_match('#'.$re.'#', $sample));
            if (! $covered) {
                $missing[] = $path;
            }
        }
        $this->assertSame([], array_values(array_unique($missing)), 'Add these to docs/edge-paths.json and the blokmix.com Worker');
    }

    public function test_the_short_address_pattern_matches_the_apps(): void
    {
        $edge = json_decode(file_get_contents(base_path('docs/edge-paths.json')), true);
        $this->assertContains('^/'.\App\Models\Mix::SHORT_PATTERN.'$', $edge['patterns']);
        foreach (['/k3x9', '/ab2cd'] as $yes) {
            $this->assertMatchesRegularExpression('#'.$edge['patterns'][0].'#', $yes);
        }
        foreach (['/about', '/login', '/k3x9/edit', '/abc', '/'] as $no) {
            $this->assertDoesNotMatchRegularExpression('#'.$edge['patterns'][0].'#', $no);
        }
    }

    public function test_the_cookie_is_the_one_marked_while_signed_in(): void
    {
        $edge = json_decode(file_get_contents(base_path('docs/edge-paths.json')), true);
        $this->assertSame(\App\Http\Middleware\MarkSignedIn::COOKIE, $edge['cookie']);
    }
}
