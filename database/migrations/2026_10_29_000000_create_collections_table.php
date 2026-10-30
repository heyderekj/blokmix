<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Collections saved to an account (posts, team, products…): a schema and its entries, shared by the owner's
        // mixes, bound to section lists on the board and exported as Astro content collections.
        Schema::create('collections', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // What mixes bind to ("collection": "posts") and the export's folder name. Unique per owner.
            $table->string('slug', 64);
            $table->string('name', 120);
            // The board's schema (fields, titleField, slugFrom) and entries, as it sends them.
            $table->jsonb('schema');
            $table->jsonb('entries');
            // Optimistic locking, like mixes: every save names the lock it read (If-Match) and bumps it.
            $table->unsignedInteger('lock')->default(1);
            $table->timestamps();
            $table->unique(['user_id', 'slug']);
        });

        // Uploads a collection's entries use, kept on the uploads disk beside mixes' (collections/<id>/…).
        Schema::create('collection_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('collection_id')->constrained()->cascadeOnDelete();
            // The board's own id for it ("img_…", "vid_…", "lot_…"), which entries refer to.
            $table->string('key', 32);
            $table->string('kind', 16);
            $table->string('name');
            $table->string('mime', 100);
            $table->unsignedInteger('width')->default(0);
            $table->unsignedInteger('height')->default(0);
            $table->unsignedBigInteger('size')->default(0);
            $table->string('path');
            $table->string('poster_path')->nullable();
            $table->timestamps();
            $table->unique(['collection_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_assets');
        Schema::dropIfExists('collections');
    }
};
