<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A Polar order that granted mix packs (one row per order, so a redelivered webhook grants nothing). */
class BillingOrder extends Model
{
    protected $fillable = ['user_id', 'polar_order_id', 'product_key', 'packs', 'amount_cents', 'refunded_at'];

    protected function casts(): array
    {
        return ['packs' => 'integer', 'amount_cents' => 'integer', 'refunded_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
