<?php

use App\Http\Controllers\MixController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/mixes/local');

Route::get('/mixes', [MixController::class, 'index'])->name('mixes.index');
Route::get('/mixes/{mix}', [MixController::class, 'show'])->name('mixes.show');
