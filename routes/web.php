<?php

use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\ClipController;
use App\Http\Controllers\Api\CollectionAssetController;
use App\Http\Controllers\Api\CollectionController;
use App\Http\Controllers\Api\LibraryController;
use App\Http\Controllers\Api\MixApiController;
use App\Http\Controllers\Api\PublicationController;
use App\Http\Controllers\Api\StyleGuideController;
use App\Http\Controllers\Api\UnsplashController;
use App\Http\Controllers\Api\WaitlistController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\LibraryAdminController;
use App\Http\Controllers\MixController;
use App\Http\Controllers\PublishedController;
use App\Models\Mix;
use App\Http\Controllers\ShareController;
use App\Http\Controllers\WaitlistController as WaitlistPage;
use Illuminate\Support\Facades\Route;

// blok.page: published mixes, first so nothing else answers on that host. No web middleware: no session, no cookies, no
// CSRF, so the pages people make never sit beside a signed-in session.
Route::domain(config('blokmix.publish_host'))->withoutMiddleware('web')->group(function () {
    Route::get('/', [PublishedController::class, 'home'])->name('published.home');
    Route::get('/{code}/{rest?}', [PublishedController::class, 'show'])->where('code', Mix::SHORT_PATTERN)->where('rest', '.*')->name('published.show');
    Route::any('/{any}', fn () => response('Not found', 404, ['X-Robots-Tag' => 'noindex, nofollow']))->where('any', '.*');
});

// Share links work for people who aren't signed in yet (they sign up, then come back here).
Route::get('/share/{token}', [ShareController::class, 'join'])->name('share.join');

// blokmix.com's waitlist form (signed out, no CSRF token: see WaitlistController).
Route::post('/api/waitlist', [WaitlistController::class, 'store'])->middleware('throttle:6,1')->name('waitlist.store');

// Polar tells us when a mix pack is paid for or refunded (signed, no CSRF token: see bootstrap/app.php). Under /api
// like the rest, so the edge in front of blokmix.com already sends it here.
Route::post('/api/polar/webhook', [BillingController::class, 'webhook'])->name('polar.webhook');

Route::middleware('auth')->group(function () {
    // Your mixes are the home page when you're signed in (signed out, blokmix.com's edge serves the website).
    Route::get('/', [MixController::class, 'index'])->name('mixes.index');
    Route::redirect('/mixes', '/');
    Route::post('/mixes', [MixController::class, 'store'])->name('mixes.store');
    // A mix lives at its short address (blokmix.com/k3x9, the route last in this file); the old addresses forward there.
    Route::get('/local', [MixController::class, 'local'])->name('mixes.local');
    Route::permanentRedirect('/mixes/local', '/local');
    Route::get('/mixes/{mix}', [MixController::class, 'moved'])->whereUlid('mix');

    // The waitlist, for the people who run Blokmix (404 for everyone else).
    Route::get('/waitlist', [WaitlistPage::class, 'index'])->name('waitlist.index');
    Route::get('/waitlist/export', [WaitlistPage::class, 'export'])->name('waitlist.export');
    Route::delete('/waitlist/{id}', [WaitlistPage::class, 'destroy'])->whereNumber('id')->name('waitlist.destroy');

    // Curating the site library, for the people who run Blokmix (404 for everyone else).
    Route::get('/library/admin/{slug?}', [LibraryAdminController::class, 'index'])->name('library.admin');

    // Where the board saves, and who it's shared with (same session and CSRF protection as the pages).
    Route::prefix('api')->name('api.')->group(function () {
        Route::post('/mixes', [MixApiController::class, 'store'])->name('mixes.store');
        Route::get('/mixes/{mix}', [MixApiController::class, 'show'])->name('mixes.show');
        Route::put('/mixes/{mix}', [MixApiController::class, 'update'])->name('mixes.update');
        Route::delete('/mixes/{mix}', [MixApiController::class, 'destroy'])->name('mixes.destroy');
        Route::patch('/mixes/{mix}/name', [MixApiController::class, 'rename'])->name('mixes.rename');
        Route::post('/mixes/{mix}/archive', [MixApiController::class, 'archive'])->name('mixes.archive');
        Route::post('/mixes/{mix}/unarchive', [MixApiController::class, 'unarchive'])->name('mixes.unarchive');
        Route::post('/mixes/{mix}/duplicate', [MixApiController::class, 'duplicate'])->middleware('throttle:20,1')->name('mixes.duplicate');

        Route::get('/mixes/{mix}/assets', [AssetController::class, 'index'])->name('assets.index');
        Route::post('/mixes/{mix}/assets', [AssetController::class, 'store'])->name('assets.store');
        Route::get('/mixes/{mix}/assets/{key}', [AssetController::class, 'show'])->name('assets.show');
        Route::get('/mixes/{mix}/assets/{key}/poster', [AssetController::class, 'poster'])->name('assets.poster');

        // Buying a mix pack, and its receipts, at Polar.
        Route::post('/billing/checkout', [BillingController::class, 'checkout'])->middleware('throttle:10,1')->name('billing.checkout');
        Route::get('/billing/receipts', [BillingController::class, 'receipts'])->name('billing.receipts');

        Route::get('/clips', [ClipController::class, 'index'])->name('clips.index');
        Route::post('/clips', [ClipController::class, 'store'])->middleware('throttle:30,1')->name('clips.store');

        Route::get('/style-guides', [StyleGuideController::class, 'index'])->name('style-guides.index');
        Route::post('/style-guides', [StyleGuideController::class, 'store'])->middleware('throttle:30,1')->name('style-guides.store');
        Route::delete('/style-guides/{guide}', [StyleGuideController::class, 'destroy'])->whereNumber('guide')->name('style-guides.destroy');

        // Collections: yours, or another account's through a mix that binds it (?mix=<id>).
        Route::get('/collections', [CollectionController::class, 'index'])->name('collections.index');
        Route::post('/collections', [CollectionController::class, 'store'])->middleware('throttle:30,1')->name('collections.store');
        Route::get('/collections/{collection}', [CollectionController::class, 'show'])->whereUlid('collection')->name('collections.show');
        Route::put('/collections/{collection}', [CollectionController::class, 'update'])->whereUlid('collection')->name('collections.update');
        Route::delete('/collections/{collection}', [CollectionController::class, 'destroy'])->whereUlid('collection')->name('collections.destroy');
        Route::get('/collections/{collection}/assets', [CollectionAssetController::class, 'index'])->whereUlid('collection')->name('collections.assets.index');
        Route::post('/collections/{collection}/assets', [CollectionAssetController::class, 'store'])->whereUlid('collection')->name('collections.assets.store');
        Route::get('/collections/{collection}/assets/{key}', [CollectionAssetController::class, 'show'])->whereUlid('collection')->name('collections.assets.show');
        Route::get('/collections/{collection}/assets/{key}/poster', [CollectionAssetController::class, 'poster'])->whereUlid('collection')->name('collections.assets.poster');

        Route::get('/unsplash/search', [UnsplashController::class, 'search'])->middleware('throttle:60,1')->name('unsplash.search');
        Route::post('/unsplash/download', [UnsplashController::class, 'download'])->middleware('throttle:60,1')->name('unsplash.download');

        // The site library: signed-in people browse published sites; the people who run Blokmix upload and curate.
        Route::get('/library', [LibraryController::class, 'index'])->name('library.index');
        Route::post('/library/sites', [LibraryController::class, 'store'])->middleware('throttle:30,1')->name('library.store');
        Route::get('/library/sites/{slug}', [LibraryController::class, 'show'])->name('library.show');
        Route::patch('/library/sites/{slug}', [LibraryController::class, 'update'])->name('library.update');
        Route::delete('/library/sites/{slug}', [LibraryController::class, 'destroy'])->name('library.destroy');
        Route::patch('/library/sections/{section}', [LibraryController::class, 'updateSection'])->whereNumber('section')->name('library.sections.update');
        Route::get('/library/assets/{id}', [LibraryController::class, 'asset'])->where('id', 'ls_[a-z0-9]{8}')->name('library.assets.show');

        // The mix on blok.page.
        Route::get('/mixes/{mix}/publication', [PublicationController::class, 'show'])->name('publication.show');
        Route::post('/mixes/{mix}/publication', [PublicationController::class, 'update'])->middleware('throttle:20,1')->name('publication.update');
        Route::delete('/mixes/{mix}/publication', [PublicationController::class, 'destroy'])->name('publication.destroy');

        Route::get('/mixes/{mix}/share', [ShareController::class, 'index'])->name('share.index');
        Route::post('/mixes/{mix}/share/links', [ShareController::class, 'createLink'])->name('share.links.store');
        Route::delete('/mixes/{mix}/share/links/{link}', [ShareController::class, 'revokeLink'])->name('share.links.destroy');
        Route::patch('/mixes/{mix}/share/members/{user}', [ShareController::class, 'updateMember'])->name('share.members.update');
        Route::delete('/mixes/{mix}/share/members/{user}', [ShareController::class, 'removeMember'])->name('share.members.destroy');
    });
});

// A mix at its short address. Last, so named paths (/login, /waitlist…) always win; the pattern needs a digit.
Route::middleware('auth')->get('/{mix:short}', [MixController::class, 'show'])->where('mix', Mix::SHORT_PATTERN)->name('mixes.show');
