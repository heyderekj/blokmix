<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Uploads a mix uses (images, videos, Lotties), kept on the uploads disk (Cloud's bucket).
        Schema::create('mix_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('mix_id')->constrained()->cascadeOnDelete();
            // The board's own id for it ("img_…", "vid_…", "lot_…"), which the mix's blocks refer to.
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
            $table->unique(['mix_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mix_assets');
    }
};
