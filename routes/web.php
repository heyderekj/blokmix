<?php

use App\Http\Controllers\Api\MixApiController;
use App\Http\Controllers\MixController;
use App\Http\Controllers\ShareController;
use Illuminate\Support\Facades\Route;

// Share links work for people who aren't signed in yet (they sign up, then come back here).
Route::get('/share/{token}', [ShareController::class, 'join'])->name('share.join');

Route::middleware('auth')->group(function () {
    // Your mixes are the home page when you're signed in (signed out, blokmix.com's edge serves the website).
    Route::get('/', [MixController::class, 'index'])->name('mixes.index');
    Route::redirect('/mixes', '/');
    Route::post('/mixes', [MixController::class, 'store'])->name('mixes.store');
    Route::get('/mixes/local', [MixController::class, 'local'])->name('mixes.local');
    Route::get('/mixes/{mix}', [MixController::class, 'show'])->name('mixes.show');

    // Where the board saves, and who it's shared with (same session and CSRF protection as the pages).
    Route::prefix('api')->name('api.')->group(function () {
        Route::post('/mixes', [MixApiController::class, 'store'])->name('mixes.store');
        Route::get('/mixes/{mix}', [MixApiController::class, 'show'])->name('mixes.show');
        Route::put('/mixes/{mix}', [MixApiController::class, 'update'])->name('mixes.update');
        Route::delete('/mixes/{mix}', [MixApiController::class, 'destroy'])->name('mixes.destroy');

        Route::get('/mixes/{mix}/share', [ShareController::class, 'index'])->name('share.index');
        Route::post('/mixes/{mix}/share/links', [ShareController::class, 'createLink'])->name('share.links.store');
        Route::delete('/mixes/{mix}/share/links/{link}', [ShareController::class, 'revokeLink'])->name('share.links.destroy');
        Route::patch('/mixes/{mix}/share/members/{user}', [ShareController::class, 'updateMember'])->name('share.members.update');
        Route::delete('/mixes/{mix}/share/members/{user}', [ShareController::class, 'removeMember'])->name('share.members.destroy');
    });
});
