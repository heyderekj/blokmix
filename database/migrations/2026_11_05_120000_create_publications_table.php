<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // What's live on blok.page: a mix's pages (later a skin or a packet), at blok.page/<code>/<slug>. The files sit on
        // the uploads disk under published/<code>/. Unpublishing deletes them and keeps the row, so a code is never reused.
        Schema::create('publications', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code', 16)->unique();
            $table->string('kind', 16)->default('mix');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('mix_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('version_key', 64)->nullable();
            $table->string('name');
            $table->string('slug', 80);
            $table->json('pages');
            $table->unsignedBigInteger('size')->default(0);
            $table->boolean('badge')->default(true);
            $table->boolean('reviews')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('unpublished_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('publications');
    }
};
