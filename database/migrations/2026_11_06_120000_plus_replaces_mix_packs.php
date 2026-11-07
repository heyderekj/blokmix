<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Mix packs give way to Plus, one unlock bought once (docs/pricing.md): anyone with a pack has Plus. */
    public function up(): void
    {
        DB::table('users')->where('mix_packs', '>', 0)->update(['plan' => 'plus']);
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('mix_packs');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('mix_packs')->default(0)->after('plan');
        });
    }
};
