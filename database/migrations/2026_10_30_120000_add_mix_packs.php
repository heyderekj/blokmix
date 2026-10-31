<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Mix packs bought (three mixes each, config/blokmix.php `pack`), and who the account is at Polar.
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('mix_packs')->default(0)->after('plan');
            $table->string('polar_customer_id')->nullable()->after('mix_packs');
        });
        // An archived mix is kept, read-only, and doesn't take one of its owner's mixes.
        Schema::table('mixes', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable();
        });
        // One row per Polar order, so a redelivered webhook never grants a pack twice.
        Schema::create('billing_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('polar_order_id')->unique();
            $table->string('product_key', 32);
            $table->unsignedInteger('packs')->default(0);
            $table->unsignedInteger('amount_cents')->default(0);
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_orders');
        Schema::table('mixes', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['mix_packs', 'polar_customer_id']);
        });
    }
};
