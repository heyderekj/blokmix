<?php

namespace App\Models;

use App\Enums\MixRole;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A collection saved to an account: a schema (fields, titleField, slugFrom) and its entries, shared by the owner's
 * mixes. The owner changes anything. Through a mix that binds it ("collection": "<slug>" in the mix's data) and that
 * the owner can edit, the mix's editors change its entries and its viewers read it.
 */
class Collection extends Model
{
    use HasUlids;

    protected $fillable = ['slug', 'name', 'schema', 'entries'];

    protected $attributes = ['lock' => 1];

    protected function casts(): array
    {
        return ['schema' => 'array', 'entries' => 'array', 'lock' => 'integer'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(CollectionAsset::class);
    }

    /**
     * What this person can do here: owner for the owner; through $mix, their role in it when the mix binds this
     * collection and its owner can edit that mix; null otherwise.
     */
    public function roleOf(?User $user, ?Mix $mix = null): ?MixRole
    {
        if (! $user) {
            return null;
        }
        if ($this->user_id === $user->id) {
            return MixRole::Owner;
        }
        if (! $mix || ! $mix->roleOf($this->user)?->canEdit() || ! in_array($this->slug, static::boundIn($mix), true)) {
            return null;
        }
        $role = $mix->roleOf($user);

        // The mix's owner is an editor of a collection someone else owns.
        return $role === MixRole::Owner ? MixRole::Editor : $role;
    }

    /** The collection slugs a mix's data binds ("collection": "<slug>", anywhere in it). */
    public static function boundIn(Mix $mix): array
    {
        $slugs = [];
        $walk = function ($node) use (&$walk, &$slugs) {
            if (! is_array($node)) {
                return;
            }
            foreach ($node as $key => $value) {
                if ($key === 'collection' && is_string($value)) {
                    $slugs[$value] = true;
                } else {
                    $walk($value);
                }
            }
        };
        $walk($mix->data ?? []);

        return array_keys($slugs);
    }

    /** The collection as the board reads it, with what $role may do. */
    public function toBoard(?MixRole $role = null): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'schema' => $this->schema,
            'entries' => $this->entries ?? [],
            'lock' => $this->lock,
            'owner' => ['id' => $this->user_id, 'name' => $this->user?->name],
            'role' => ($role ?? MixRole::Owner)->value,
            'updated_at' => $this->updated_at,
        ];
    }
}
