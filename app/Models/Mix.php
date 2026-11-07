<?php

namespace App\Models;

use App\Enums\MixRole;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A mix: its pages, style guide, words and notes in `data`, its versions as rows. It lives at a short address
 * (`short`, blokmix.com/k3x9); the ULID stays its key for the API and storage.
 */
class Mix extends Model
{
    /** A mix holds at most this many drafts. */
    public const MAX_DRAFTS = 6;

    use HasUlids;

    /** Short addresses: lowercase letters and digits without look-alikes (no i, l, o, 0, 1). */
    private const SHORT_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

    /** What a short address looks like (routes and the edge in front of blokmix.com use the same rule). */
    public const SHORT_PATTERN = '(?=[a-z0-9]*[0-9])[a-z0-9]{4,8}';

    protected $fillable = ['name', 'data', 'schema'];

    protected $attributes = ['schema' => 1, 'lock_version' => 1];

    protected static function booted(): void
    {
        static::creating(function (Mix $mix) {
            $mix->short ??= static::freshShort();
        });
    }

    /**
     * A new, unused short address: 4 characters with at least one digit, so it never spells a word or a site page
     * (/about, /login). After a few collisions it takes 5, then more.
     */
    public static function freshShort(): string
    {
        for ($tries = 0; ; $tries++) {
            $length = 4 + intdiv($tries, 5);
            $short = '';
            for ($i = 0; $i < $length; $i++) {
                $short .= self::SHORT_CHARS[random_int(0, strlen(self::SHORT_CHARS) - 1)];
            }
            if (preg_match('/[0-9]/', $short) && ! static::query()->where('short', $short)->exists()) {
                return $short;
            }
        }
    }

    protected function casts(): array
    {
        return ['data' => 'array', 'schema' => 'integer', 'lock_version' => 'integer', 'archived_at' => 'datetime'];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(MixVersion::class);
    }

    /** Its drafts, side by side on the board; the open one's body is `data`. */
    public function drafts(): HasMany
    {
        return $this->hasMany(MixDraft::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'mix_members')->withPivot('role')->withTimestamps();
    }

    public function assets(): HasMany
    {
        return $this->hasMany(MixAsset::class);
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

    /** Archived: kept and readable, but nobody changes it (marks aside) until its owner brings it back. */
    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    /** Whether someone with this role can change the mix now: editors and owners, unless it's archived. */
    public function changeableBy(?MixRole $role): bool
    {
        return $role !== null && $role->canEdit() && ! $this->isArchived();
    }

    /** Whoever owns the mix: its uploads count toward their plan, and its features follow their plan. */
    public function owner(): ?User
    {
        return $this->members()->wherePivot('role', MixRole::Owner->value)->first();
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
            'short' => $this->short,
            'name' => $this->name,
            'data' => $this->data,
            'versions' => $this->versions->mapWithKeys(fn (MixVersion $v) => [$v->key => $v->node])->all(),
            'drafts' => $this->drafts->mapWithKeys(fn (MixDraft $d) => [$d->key => $d->node])->all(),
            'lock' => $this->lock_version,
            'schema' => $this->schema,
            'archived' => $this->isArchived(),
            // What the board opens follows the owner's plan, so editors and viewers never need a pack.
            'paid' => (bool) $this->owner()?->hasPlus(),
        ];
    }
}
