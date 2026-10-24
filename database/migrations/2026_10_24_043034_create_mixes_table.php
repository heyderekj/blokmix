<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mixes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            // The mix as the board saves it: site, guide, content, notes, heads and frame positions.
            // Null until the board first saves it (a new mix starts blank in the browser).
            $table->jsonb('data')->nullable();
            // The saved shape's version; the board's own migrations (store.ts merge) bring older data up to date.
            $table->unsignedSmallInteger('schema')->default(1);
            // Optimistic locking: every save names the lock it read (If-Match) and bumps it.
            $table->unsignedInteger('lock_version')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mixes');
    }
};
