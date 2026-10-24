<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A style guide saved to an account, to start a mix from or swap into one. */
class StyleGuide extends Model
{
    protected $fillable = ['name', 'guide'];

    protected function casts(): array
    {
        return ['guide' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
