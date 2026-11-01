<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /** A new account has bought no mix packs (the column's default, before it's read back). */
    protected $attributes = ['mix_packs' => 0];

    public function clips(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Clip::class);
    }

    public function styleGuides(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(StyleGuide::class);
    }

    public function collections(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Collection::class);
    }

    /** The mixes this person can open, with their role in each. */
    public function mixes(): BelongsToMany
    {
        return $this->belongsToMany(Mix::class, 'mix_members')->withPivot('role')->withTimestamps();
    }

    public function billingOrders(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(BillingOrder::class);
    }

    /** Free, or paid once a mix pack is bought. The people who run Blokmix, and `plan = plus` given by hand, are paid. */
    public function planName(): string
    {
        return $this->mix_packs > 0 || $this->unlimited() ? 'paid' : 'free';
    }

    /** No limits: the people who run Blokmix, accounts given `plan = plus` by hand, and everyone while on the waitlist. */
    public function unlimited(): bool
    {
        return config('blokmix.waitlist_mode') || $this->plan === 'plus' || in_array(strtolower($this->email), config('blokmix.owners'), true);
    }

    /** How many mixes can be open at once: one on Free, three per pack, null for no limit. */
    public function mixSlots(): ?int
    {
        if ($this->unlimited()) {
            return null;
        }

        return max(1, $this->mix_packs * config('blokmix.pack.mixes'));
    }

    /** What the plan includes: mixes (open at once), clips, upload_mb, collections and entries (per collection), null for unlimited. */
    public function limits(): array
    {
        return ['mixes' => $this->mixSlots()] + config('blokmix.plans.'.$this->planName());
    }

    /** The mixes this person owns (shared ones don't count toward the plan). */
    public function ownedMixes(): BelongsToMany
    {
        return $this->mixes()->wherePivot('role', 'owner');
    }

    /** The owned mixes that take a slot: everything but the archived ones. */
    public function activeMixes(): BelongsToMany
    {
        return $this->ownedMixes()->whereNull('mixes.archived_at');
    }

    /** What counts toward the plan: open mixes owned, clips saved, collections owned, and bytes uploaded into owned mixes and collections. */
    public function usage(): array
    {
        return [
            'mixes' => $this->activeMixes()->count(),
            'clips' => $this->clips()->count(),
            'collections' => $this->collections()->count(),
            'uploads' => (int) MixAsset::whereIn('mix_id', $this->ownedMixes()->select('mixes.id'))->sum('size')
                + (int) CollectionAsset::whereIn('collection_id', $this->collections()->select('id'))->sum('size'),
        ];
    }

    /** Why this person can't open another mix, new or brought back from the archive (null when they can). */
    public function mixRefusal(): ?string
    {
        $max = $this->mixSlots();
        if ($max === null || $this->activeMixes()->count() < $max) {
            return null;
        }
        $price = config('blokmix.pack.price_usd');
        $per = config('blokmix.pack.mixes');

        return $this->planName() === 'free'
            ? "Free has one mix. Archive it, or get a mix pack: {$per} mixes for \${$price}, once."
            : "Your mix packs hold {$max} mixes. Archive one, or add a pack: {$per} more for \${$price}.";
    }

    /**
     * Why this person can't start another collection (no $entries), or why one of theirs can't hold $entries entries
     * (null when they can).
     */
    public function collectionRefusal(?int $entries = null): ?string
    {
        if ($entries !== null) {
            $max = $this->limits()['entries'] ?? null;

            return $max !== null && $entries > $max
                ? "Free includes {$max} entries in a collection. Remove one to make room, or get a mix pack for as many as you like."
                : null;
        }
        $max = $this->limits()['collections'] ?? null;

        return $max !== null && $this->collections()->count() >= $max
            ? ($max === 1 ? 'Free includes one collection. A mix pack has as many as you like.' : "Your plan includes {$max} collections.")
            : null;
    }

    /** Why this person can't save another clip (null when they can). */
    public function clipRefusal(): ?string
    {
        $max = $this->limits()['clips'];

        return $max !== null && $this->clips()->count() >= $max
            ? "Free includes {$max} clips. Remove one to make room, or get a mix pack for as many as you like."
            : null;
    }

    /** Why this person's mixes can't take another $bytes of uploads (null when they can). */
    public function uploadRefusal(int $bytes): ?string
    {
        $mb = $this->limits()['upload_mb'];

        return $mb !== null && $this->usage()['uploads'] + $bytes > $mb * 1024 * 1024
            ? ($this->planName() === 'free' ? "Free includes {$mb} MB of images and video, and this would go over. It stays in this browser." : "That would go over your {$mb} MB of uploads.")
            : null;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'mix_packs' => 'integer',
        ];
    }
}
