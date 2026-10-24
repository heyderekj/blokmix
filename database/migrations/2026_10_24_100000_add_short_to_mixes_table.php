<?php

use App\Models\Mix;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A mix's address: blokmix.com/k3x9 (Mix::freshShort). The ULID stays the key for the API and storage.
        Schema::table('mixes', function (Blueprint $table) {
            $table->string('short', 8)->nullable()->unique();
        });
        foreach (DB::table('mixes')->whereNull('short')->pluck('id') as $id) {
            DB::table('mixes')->where('id', $id)->update(['short' => Mix::freshShort()]);
        }
    }

    public function down(): void
    {
        Schema::table('mixes', function (Blueprint $table) {
            $table->dropUnique(['short']);
            $table->dropColumn('short');
        });
    }
};
