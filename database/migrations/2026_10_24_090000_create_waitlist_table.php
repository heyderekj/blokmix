<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // People waiting for Blokmix, from blokmix.com's waitlist form. One row per email.
        Schema::create('waitlist', function (Blueprint $table) {
            $table->id();
            $table->string('email', 254)->unique();
            // Which form they used ("hero", "closing").
            $table->string('source', 40)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waitlist');
    }
};
