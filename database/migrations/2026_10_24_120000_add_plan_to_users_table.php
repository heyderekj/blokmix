<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Free or Plus (config/blokmix.php `plans`). Everyone starts on Free; checkout will set Plus later.
        Schema::table('users', function (Blueprint $table) {
            $table->string('plan', 16)->default('free')->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('plan');
        });
    }
};
