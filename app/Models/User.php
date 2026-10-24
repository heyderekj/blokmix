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

    /** The mixes this person can open, with their role in each. */
    public function mixes(): BelongsToMany
    {
        return $this->belongsToMany(Mix::class, 'mix_members')->withPivot('role')->withTimestamps();
    }

    /** Free or Plus. The people who run Blokmix are always on Plus. */
    public function planName(): string
    {
        if ($this->plan === 'plus' || in_array(strtolower($this->email), config('blokmix.owners'), true)) {
            return 'plus';
        }

        return array_key_exists($this->plan, config('blokmix.plans')) ? $this->plan : 'free';
    }

    /** What the plan includes: mixes, clips and upload_mb, null for unlimited. */
    public function limits(): array
    {
        return config('blokmix.plans.'.$this->planName());
    }

    /** The mixes this person owns (shared ones don't count toward the plan). */
    public function ownedMixes(): BelongsToMany
    {
        return $this->mixes()->wherePivot('role', 'owner');
    }

    /** What counts toward the plan: mixes owned, clips saved, and bytes uploaded into owned mixes. */
    public function usage(): array
    {
        return [
            'mixes' => $this->ownedMixes()->count(),
            'clips' => $this->clips()->count(),
            'uploads' => (int) MixAsset::whereIn('mix_id', $this->ownedMixes()->select('mixes.id'))->sum('size'),
        ];
    }

    /** Why this person can't start another mix (null when they can). */
    public function mixRefusal(): ?string
    {
        $max = $this->limits()['mixes'];

        return $max !== null && $this->ownedMixes()->count() >= $max
            ? ($max === 1 ? 'Free includes one mix. Plus, coming soon, has as many as you like.' : "Your plan includes {$max} mixes.")
            : null;
    }

    /** Why this person can't save another clip (null when they can). */
    public function clipRefusal(): ?string
    {
        $max = $this->limits()['clips'];

        return $max !== null && $this->clips()->count() >= $max
            ? "Free includes {$max} clips. Remove one to make room, or wait for Plus, coming soon."
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
