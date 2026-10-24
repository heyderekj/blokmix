<?php

namespace App\Models;

use App\Enums\MixRole;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A mix: its pages, style guide, words and notes in `data`, its versions as rows.
 */
class Mix extends Model
{
    use HasUlids;

    protected $fillable = ['name', 'data', 'schema'];

    protected $attributes = ['schema' => 1, 'lock_version' => 1];

    protected function casts(): array
    {
        return ['data' => 'array', 'schema' => 'integer', 'lock_version' => 'integer'];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(MixVersion::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'mix_members')->withPivot('role')->withTimestamps();
    }

    public function shareLinks(): HasMany
    {
        return $this->hasMany(MixShareLink::class);
    }

    /** What this person can do here; null when they're not a member. */
    public function roleOf(?User $user): ?MixRole
    {
        if (! $user) {
            return null;
        }
        $member = $this->relationLoaded('members') ? $this->members->firstWhere('id', $user->id) : $this->members()->whereKey($user->id)->first();

        return $member ? MixRole::from($member->pivot->role) : null;
    }

    /** Add someone, or raise their role; never lowers it. */
    public function admit(User $user, MixRole $role): MixRole
    {
        $current = $this->roleOf($user);
        if ($current && $current->rank() >= $role->rank()) {
            return $current;
        }
        $this->members()->syncWithoutDetaching([$user->id => ['role' => $role->value]]);
        $this->unsetRelation('members');

        return $role;
    }

    /** The mix as the board reads it. */
    public function toBoard(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'data' => $this->data,
            'versions' => $this->versions->mapWithKeys(fn (MixVersion $v) => [$v->key => $v->node])->all(),
            'lock' => $this->lock_version,
            'schema' => $this->schema,
        ];
    }
}
