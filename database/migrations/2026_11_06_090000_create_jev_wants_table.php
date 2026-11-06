<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // What people asked for that Blokmix couldn't do yet (Say it, Pour, Dress it up), named by Jev from a closed list
        // (resources/js/core/jev/wants.ts). Only the name is kept: never anyone's words, and no account, just a count.
        Schema::create('jev_wants', function (Blueprint $table) {
            $table->id();
            $table->string('want', 32)->index();
            $table->string('feature', 16);
            $table->string('section_type', 16)->nullable();
            $table->string('kind', 16)->nullable();
            $table->timestamp('created_at')->useCurrent()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('jev_wants');
    }
};
