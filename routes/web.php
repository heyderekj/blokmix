<?php

use App\Http\Controllers\Api\MixApiController;
use App\Http\Controllers\MixController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('mixes.index');
});

Route::get('/mixes', [MixController::class, 'index'])->name('mixes.index');
Route::post('/mixes', [MixController::class, 'store'])->name('mixes.store');
Route::get('/mixes/local', [MixController::class, 'local'])->name('mixes.local');
Route::get('/mixes/{mix}', [MixController::class, 'show'])->name('mixes.show');

// Where the board saves (same session and CSRF protection as the pages).
Route::prefix('api')->name('api.')->group(function () {
    Route::post('/mixes', [MixApiController::class, 'store'])->name('mixes.store');
    Route::get('/mixes/{mix}', [MixApiController::class, 'show'])->name('mixes.show');
    Route::put('/mixes/{mix}', [MixApiController::class, 'update'])->name('mixes.update');
    Route::delete('/mixes/{mix}', [MixApiController::class, 'destroy'])->name('mixes.destroy');
});
