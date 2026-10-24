<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Style guides saved to an account, to start a new mix from or swap into one. Each mix keeps its own copy.
        Schema::create('style_guides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            // The board's GuideState (base tokens, candidates, choices), as a mix's data holds it.
            $table->jsonb('guide');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('style_guides');
    }
};
