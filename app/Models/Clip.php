<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A captured clip saved to an account (its files, as the extension's zip holds them). */
class Clip extends Model
{
    protected $fillable = ['clip_id', 'files'];

    protected function casts(): array
    {
        return ['files' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
