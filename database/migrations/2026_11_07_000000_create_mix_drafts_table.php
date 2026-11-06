<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mix_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('mix_id')->constrained()->cascadeOnDelete();
            // The board's own id for the draft ("draft_…"), unique within its mix.
            $table->string('key', 40);
            $table->string('letter', 8);
            // The whole draft: name, status, head, and its own copy of the mix unless it's the open one (whose copy is
            // the mix's `data`).
            $table->jsonb('node');
            $table->timestamps();
            $table->unique(['mix_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mix_drafts');
    }
};
