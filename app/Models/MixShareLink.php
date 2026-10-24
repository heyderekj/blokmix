<?php

namespace App\Models;

use App\Enums\MixRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/** A link that adds whoever opens it to a mix, with a role. */
class MixShareLink extends Model
{
    protected $fillable = ['token', 'role', 'created_by'];

    protected function casts(): array
    {
        return ['role' => MixRole::class, 'revoked_at' => 'datetime'];
    }

    public static function newToken(): string
    {
        return Str::random(40);
    }

    public function mix(): BelongsTo
    {
        return $this->belongsTo(Mix::class);
    }

    public function url(): string
    {
        return route('share.join', $this->token);
    }
}
