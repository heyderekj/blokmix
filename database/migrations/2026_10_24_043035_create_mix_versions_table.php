<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mix_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('mix_id')->constrained()->cascadeOnDelete();
            // The board's own id for the version ("v_…"), unique within its mix.
            $table->string('key');
            $table->string('letter');
            // The whole version node: snapshot, build and review included.
            $table->jsonb('node');
            $table->timestamps();
            $table->unique(['mix_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mix_versions');
    }
};
