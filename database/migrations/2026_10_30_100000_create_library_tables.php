<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The site library: real websites captured by the library CLI, curated by the people who run Blokmix.
        Schema::create('library_sites', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('slug', 80)->unique();
            $table->string('name');
            $table->string('url', 2048);
            $table->string('industry', 80)->nullable();
            $table->json('tags');
            // The site's style guide (Blokmix token keys: "color.bg", "font.display"…) and the fonts it loads.
            $table->json('tokens');
            $table->json('fonts');
            $table->text('personality')->nullable();
            $table->string('status', 16)->default('draft'); // draft | published
            $table->timestamps();
        });

        Schema::create('library_assets', function (Blueprint $table) {
            // "ls_xxxxxxxx", the address of its file (/api/library/assets/{id}).
            $table->string('id', 16)->primary();
            $table->foreignUlid('library_site_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16); // full | section | thumb
            // The file name the bundle's site.json uses for it.
            $table->string('name');
            $table->string('mime', 32);
            $table->unsignedBigInteger('size');
            $table->unsignedInteger('width')->default(0);
            $table->unsignedInteger('height')->default(0);
            $table->string('path');
            $table->timestamps();
        });

        Schema::create('library_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('library_site_id')->constrained()->cascadeOnDelete();
            $table->string('path', 2048);
            $table->string('title')->nullable();
            $table->unsignedInteger('order')->default(0);
            // The full-page screenshot's asset id.
            $table->string('screenshot', 16)->nullable();
            $table->unsignedInteger('width')->default(0);
            $table->unsignedInteger('height')->default(0);
            $table->timestamps();
        });

        Schema::create('library_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('library_page_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('order')->default(0);
            $table->string('type', 32);
            // Where it sits on the page's screenshot: {y, h} in screenshot pixels.
            $table->json('box');
            // The built-in layout a clipped section lands as ("hero.layout-split").
            $table->string('layout_id', 120)->nullable();
            $table->float('score')->nullable();
            $table->string('status', 16)->default('needs_layout'); // matched | needs_layout | hidden
            // Its crop's asset id, when the bundle has one.
            $table->string('screenshot', 16)->nullable();
            $table->json('hint')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('library_sections');
        Schema::dropIfExists('library_pages');
        Schema::dropIfExists('library_assets');
        Schema::dropIfExists('library_sites');
    }
};
