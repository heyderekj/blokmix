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

    /** Free, or Plus once it's bought (`plan = plus`, also given by hand). The people who run Blokmix, and everyone while on the waitlist, are on Plus. */
    public function planName(): string
    {
        return $this->plan === 'plus' || $this->unlimited() ? 'plus' : 'free';
    }

    /** No limits: the people who run Blokmix and everyone while on the waitlist. */
    public function unlimited(): bool
    {
        return config('blokmix.waitlist_mode') || in_array(strtolower($this->email), config('blokmix.owners'), true);
    }

    /** Whether this person has Plus (bought, given, or unlimited). */
    public function hasPlus(): bool
    {
        return $this->planName() === 'plus';
    }

    /** How many mixes can be open at once: one on Free, null (no limit) on Plus. */
    public function mixSlots(): ?int
    {
        return $this->hasPlus() ? null : config('blokmix.plans.free.mixes');
    }

    /** What the plan includes: mixes (open at once) and upload_mb, null for unlimited. */
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
                + (int) CollectionAsset::whereIn('collection_id', $this->collections()->select('id'))->sum('size')
                + (int) $this->publications()->whereNull('unpublished_at')->sum('size'),
        ];
    }

    /** Why this person can't open another mix, new or brought back from the archive (null when they can). */
    public function mixRefusal(): ?string
    {
        $max = $this->mixSlots();
        if ($max === null || $this->activeMixes()->count() < $max) {
            return null;
        }
        $price = config('blokmix.plus.price_usd');

        return "Free has one mix. Archive it, or get Plus: every mix and feature for \${$price}, once.";
    }

    /** What this person has on blok.page (counted toward them, as the owner of the mix it came from). */
    public function publications(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Publication::class);
    }

    /**
     * Why $mix can't go live on blok.page with $bytes of files (null when it can): only room. Republishing the same mix
     * replaces it, and its files only count the difference.
     */
    public function publishRefusal(Mix $mix, int $bytes): ?string
    {
        $live = $this->publications()->whereNotNull('published_at')->whereNull('unpublished_at');
        $was = (int) (clone $live)->where('mix_id', $mix->id)->value('size');
        $mb = $this->limits()['upload_mb'];

        return $mb !== null && $this->usage()['uploads'] - $was + $bytes > $mb * 1024 * 1024
            ? "Publishing this would go over your {$mb} MB of images, video and published pages."
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
        ];
    }
}
