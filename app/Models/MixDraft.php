<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One draft of a mix, as the board keeps it (core/drafts.ts `Draft`): the open one's body is the mix's data. */
class MixDraft extends Model
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
