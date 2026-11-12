<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public function clips(): HasMany
    {
        return $this->hasMany(Clip::class);
    }

    public function styleGuides(): HasMany
    {
        return $this->hasMany(StyleGuide::class);
    }

    public function collections(): HasMany
    {
        return $this->hasMany(Collection::class);
    }

    /** The mixes this person can open, with their role in each. */
    public function mixes(): BelongsToMany
    {
        return $this->belongsToMany(Mix::class, 'mix_members')->withPivot('role')->withTimestamps();
    }

    public function billingOrders(): HasMany
    {
        return $this->hasMany(BillingOrder::class);
    }

    /**
     * Plus, the old one-time unlock (`plan = plus`, bought or given by hand), kept for those who have it: every mix they
     * own ships free (Mix::ships). The people who run Blokmix, and everyone while on the waitlist, count as Plus too.
     */
    public function hasPlus(): bool
    {
        return $this->plan === 'plus' || $this->unlimited();
    }

    /** No paywall: the people who run Blokmix and everyone while on the waitlist. */
    public function unlimited(): bool
    {
        return config('blokmix.waitlist_mode') || in_array(strtolower($this->email), config('blokmix.owners'), true);
    }

    /** The mixes this person owns (shared ones don't count toward their room). */
    public function ownedMixes(): BelongsToMany
    {
        return $this->mixes()->wherePivot('role', 'owner');
    }

    /** The owned mixes someone has paid for. */
    public function paidMixes(): BelongsToMany
    {
        return $this->ownedMixes()->whereNotNull('mixes.paid_at');
    }

    /** Room for uploads, in MB: a guardrail, more once they've paid for a site (or have Plus). Never printed as a feature. */
    public function uploadMb(): int
    {
        $paid = $this->hasPlus() || $this->paidMixes()->exists();

        return (int) config('blokmix.upload_mb.'.($paid ? 'paid' : 'default'));
    }

    /** What counts toward their room: bytes uploaded into owned mixes and collections, and what's live on blok.page. Clips and collections are shown, never limited. */
    public function usage(): array
    {
        return [
            'clips' => $this->clips()->count(),
            'collections' => $this->collections()->count(),
            'uploads' => (int) MixAsset::whereIn('mix_id', $this->ownedMixes()->select('mixes.id'))->sum('size')
                + (int) CollectionAsset::whereIn('collection_id', $this->collections()->select('id'))->sum('size')
                + (int) $this->publications()->whereNull('unpublished_at')->sum('size'),
        ];
    }

    /** What this person has on blok.page (counted toward them, as the owner of the mix it came from). */
    public function publications(): HasMany
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
        $mb = $this->uploadMb();

        return $this->usage()['uploads'] - $was + $bytes > $mb * 1024 * 1024
            ? 'Publishing this would go over your '.self::room($mb).' of images, video and published pages.'
            : null;
    }

    /** Why this person's mixes can't take another $bytes of uploads (null when they can). */
    public function uploadRefusal(int $bytes): ?string
    {
        $mb = $this->uploadMb();

        return $this->usage()['uploads'] + $bytes > $mb * 1024 * 1024
            ? 'That would go over your '.self::room($mb).' of images and video. It stays in this browser.'
            : null;
    }

    /** 100 MB, 10 GB. */
    private static function room(int $mb): string
    {
        return $mb >= 1024 && $mb % 1024 === 0 ? ($mb / 1024).' GB' : "{$mb} MB";
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
