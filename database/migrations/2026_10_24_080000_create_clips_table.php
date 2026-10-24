<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Clips captured with the extension, saved to an account: the zip's files as they'd sit in samples/.
        Schema::create('clips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // "<type>.<source>-<variant>", the id the board knows it by.
            $table->string('clip_id', 120);
            $table->jsonb('files');
            $table->timestamps();
            $table->unique(['user_id', 'clip_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clips');
    }
};
