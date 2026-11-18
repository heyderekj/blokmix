<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_handoffs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUlid('mix_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('version');
            $table->string('draft');
            $table->longText('packet');
            $table->timestamps();
        });
        Schema::create('agent_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('handoff')->references('id')->on('agent_handoffs')->cascadeOnDelete();
            $table->uuid('submission');
            $table->text('payload');
            $table->unique(['handoff', 'submission']);
        });
        Schema::create('layout_suggestions', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('mix_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 100);
            $table->text('recipe');
            $table->string('status')->default('pending')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('layout_suggestions');
        Schema::dropIfExists('agent_returns');
        Schema::dropIfExists('agent_handoffs');
    }
};
