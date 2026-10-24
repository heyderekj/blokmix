<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One version of a mix, as the board keeps it (a VersionNode). */
class MixVersion extends Model
{
    protected $fillable = ['key', 'letter', 'node'];

    protected function casts(): array
    {
        return ['node' => 'array'];
    }

    public function mix(): BelongsTo
    {
        return $this->belongsTo(Mix::class);
    }
}
