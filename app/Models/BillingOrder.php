<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A Polar order: a site paid for (`mix_id`), or Plus from before. One row per order, so a redelivered webhook grants nothing. */
class BillingOrder extends Model
{
    protected $fillable = ['user_id', 'mix_id', 'polar_order_id', 'product_key', 'amount_cents', 'refunded_at'];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'refunded_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The mix it paid for (null for Plus, or once the mix is deleted). */
    public function mix(): BelongsTo
    {
        return $this->belongsTo(Mix::class);
    }
}
