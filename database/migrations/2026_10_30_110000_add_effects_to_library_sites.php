<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The effects a captured site uses (shadow, gradient, grain, glass, glow), as Blokmix treatment values:
        // {"shadow": {"id": "shadow", "params": {...}}, ...}. A mix can take them as its look kit.
        Schema::table('library_sites', function (Blueprint $table) {
            $table->json('effects')->nullable()->after('fonts');
        });
    }

    public function down(): void
    {
        Schema::table('library_sites', function (Blueprint $table) {
            $table->dropColumn('effects');
        });
    }
};
