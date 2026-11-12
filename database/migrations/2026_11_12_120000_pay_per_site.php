<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Free to make, $30 a site when you ship it (docs/pricing.md): a payment belongs to one mix. `paid_at` says it's paid
     * for, `paid_order_id` which order paid (a full refund of that order un-pays it). Orders name the mix they paid for;
     * mix packs are long gone, so `packs` goes. Plus (`users.plan`) stays for those who bought it: their mixes ship free.
     */
    public function up(): void
    {
        Schema::table('mixes', function (Blueprint $table) {
            $table->timestamp('paid_at')->nullable();
            $table->unsignedBigInteger('paid_order_id')->nullable()->index();
        });
        Schema::table('billing_orders', function (Blueprint $table) {
            // Kept when the mix is deleted: the order is still a record of what was paid.
            $table->ulid('mix_id')->nullable()->index()->after('user_id');
            $table->dropColumn('packs');
        });
    }

    public function down(): void
    {
        Schema::table('billing_orders', function (Blueprint $table) {
            $table->dropIndex(['mix_id']);
            $table->dropColumn('mix_id');
            $table->unsignedInteger('packs')->default(0);
        });
        Schema::table('mixes', function (Blueprint $table) {
            $table->dropIndex(['paid_order_id']);
            $table->dropColumn(['paid_at', 'paid_order_id']);
        });
    }
};
