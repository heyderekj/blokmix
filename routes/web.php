<?php

use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\ClipController;
use App\Http\Controllers\Api\MixApiController;
use App\Http\Controllers\Api\StyleGuideController;
use App\Http\Controllers\Api\UnsplashController;
use App\Http\Controllers\Api\WaitlistController;
use App\Http\Controllers\MixController;
use App\Models\Mix;
use App\Http\Controllers\ShareController;
use App\Http\Controllers\WaitlistController as WaitlistPage;
use Illuminate\Support\Facades\Route;

// Share links work for people who aren't signed in yet (they sign up, then come back here).
Route::get('/share/{token}', [ShareController::class, 'join'])->name('share.join');

// blokmix.com's waitlist form (signed out, no CSRF token: see WaitlistController).
Route::post('/api/waitlist', [WaitlistController::class, 'store'])->middleware('throttle:6,1')->name('waitlist.store');

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

    // Where the board saves, and who it's shared with (same session and CSRF protection as the pages).
    Route::prefix('api')->name('api.')->group(function () {
        Route::post('/mixes', [MixApiController::class, 'store'])->name('mixes.store');
        Route::get('/mixes/{mix}', [MixApiController::class, 'show'])->name('mixes.show');
        Route::put('/mixes/{mix}', [MixApiController::class, 'update'])->name('mixes.update');
        Route::delete('/mixes/{mix}', [MixApiController::class, 'destroy'])->name('mixes.destroy');
        Route::patch('/mixes/{mix}/name', [MixApiController::class, 'rename'])->name('mixes.rename');
        Route::post('/mixes/{mix}/duplicate', [MixApiController::class, 'duplicate'])->middleware('throttle:20,1')->name('mixes.duplicate');

        Route::get('/mixes/{mix}/assets', [AssetController::class, 'index'])->name('assets.index');
        Route::post('/mixes/{mix}/assets', [AssetController::class, 'store'])->name('assets.store');
        Route::get('/mixes/{mix}/assets/{key}', [AssetController::class, 'show'])->name('assets.show');
        Route::get('/mixes/{mix}/assets/{key}/poster', [AssetController::class, 'poster'])->name('assets.poster');

        Route::get('/clips', [ClipController::class, 'index'])->name('clips.index');
        Route::post('/clips', [ClipController::class, 'store'])->middleware('throttle:30,1')->name('clips.store');

        Route::get('/style-guides', [StyleGuideController::class, 'index'])->name('style-guides.index');
        Route::post('/style-guides', [StyleGuideController::class, 'store'])->middleware('throttle:30,1')->name('style-guides.store');
        Route::delete('/style-guides/{guide}', [StyleGuideController::class, 'destroy'])->whereNumber('guide')->name('style-guides.destroy');

        Route::get('/unsplash/search', [UnsplashController::class, 'search'])->middleware('throttle:60,1')->name('unsplash.search');
        Route::post('/unsplash/download', [UnsplashController::class, 'download'])->middleware('throttle:60,1')->name('unsplash.download');

        Route::get('/mixes/{mix}/share', [ShareController::class, 'index'])->name('share.index');
        Route::post('/mixes/{mix}/share/links', [ShareController::class, 'createLink'])->name('share.links.store');
        Route::delete('/mixes/{mix}/share/links/{link}', [ShareController::class, 'revokeLink'])->name('share.links.destroy');
        Route::patch('/mixes/{mix}/share/members/{user}', [ShareController::class, 'updateMember'])->name('share.members.update');
        Route::delete('/mixes/{mix}/share/members/{user}', [ShareController::class, 'removeMember'])->name('share.members.destroy');
    });
});

// A mix at its short address. Last, so named paths (/login, /waitlist…) always win; the pattern needs a digit.
Route::middleware('auth')->get('/{mix:short}', [MixController::class, 'show'])->where('mix', Mix::SHORT_PATTERN)->name('mixes.show');
