<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Who can open a mix, and what they can do: owner (everything, sharing), editor (everything but
        // sharing and deleting), viewer (look and leave marks).
        Schema::create('mix_members', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('mix_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 16);
            $table->timestamps();
            $table->unique(['mix_id', 'user_id']);
        });

        // A link that adds whoever opens it to a mix with a role, until it's revoked.
        Schema::create('mix_share_links', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('mix_id')->constrained()->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->string('role', 16);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mix_share_links');
        Schema::dropIfExists('mix_members');
    }
};
