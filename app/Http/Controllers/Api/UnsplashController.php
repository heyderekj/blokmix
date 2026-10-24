<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

/** Unsplash through the server, so its key never reaches the browser. */
class UnsplashController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $input = $request->validate([
            'query' => ['required', 'string', 'max:100'],
            'orientation' => ['nullable', Rule::in(['landscape', 'portrait', 'squarish'])],
        ]);
        $key = $this->key();

        $res = Http::withHeaders(['Authorization' => "Client-ID {$key}", 'Accept-Version' => 'v1'])
            ->timeout(10)
            ->get('https://api.unsplash.com/search/photos', [
                'query' => $input['query'],
                'per_page' => 18,
                'orientation' => $input['orientation'] ?? 'landscape',
                'content_filter' => 'high',
            ]);

        return response()->json($res->json(), $res->status());
    }

    /** Count a download when a photo is used, as Unsplash asks. Only its own API is ever called. */
    public function download(Request $request): JsonResponse
    {
        $url = $request->validate(['url' => ['required', 'url', 'starts_with:https://api.unsplash.com/']])['url'];
        Http::withHeaders(['Authorization' => 'Client-ID '.$this->key()])->timeout(10)->get($url);

        return response()->json(null, 204);
    }

    private function key(): string
    {
        $key = (string) config('blokmix.unsplash_key');
        abort_if($key === '', 503, 'Stock photos need an Unsplash key on the server (UNSPLASH_ACCESS_KEY).');

        return $key;
    }
}
