<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * Something live on blok.page: today a mix's pages, at blok.page/<code>/<slug>. The code is the address and never
 * changes; the slug follows the name (an old one redirects). Files: published/<code>/ on the uploads disk.
 */
class Publication extends Model
{
    use HasUlids;

    /** Codes look like a mix's short address (Mix::SHORT_PATTERN): letters and digits, at least one digit. */
    public const CODE_PATTERN = Mix::SHORT_PATTERN;

    private const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

    protected $fillable = ['code', 'kind', 'user_id', 'mix_id', 'version_key', 'name', 'slug', 'pages', 'size', 'badge', 'reviews', 'published_at', 'unpublished_at'];

    protected function casts(): array
    {
        return [
            'pages' => 'array',
            'size' => 'integer',
            'badge' => 'boolean',
            'reviews' => 'boolean',
            'published_at' => 'datetime',
            'unpublished_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function mix(): BelongsTo
    {
        return $this->belongsTo(Mix::class);
    }

    public function isLive(): bool
    {
        return $this->published_at !== null && $this->unpublished_at === null;
    }

    public function dir(): string
    {
        return "published/{$this->code}";
    }

    /** blok.page/<code>/<slug>/, on whichever host publishing answers on. */
    public function url(): string
    {
        return rtrim(config('blokmix.publish_url'), '/')."/{$this->code}/{$this->slug}/";
    }

    public static function slugFor(string $name): string
    {
        return Str::limit(Str::slug($name), 60, '') ?: 'page';
    }

    /** Four characters with at least one digit, not taken by another publication. */
    public static function freshCode(): string
    {
        do {
            $code = '';
            for ($i = 0; $i < 4; $i++) {
                $code .= self::CODE_CHARS[random_int(0, strlen(self::CODE_CHARS) - 1)];
            }
        } while (! preg_match('/\d/', $code) || self::where('code', $code)->exists());

        return $code;
    }

    public function toBoard(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
            'slug' => $this->slug,
            'url' => $this->url(),
            'pages' => $this->pages,
            'size' => $this->size,
            'badge' => $this->badge,
            'version' => $this->version_key,
            'live' => $this->isLive(),
            'publishedAt' => $this->published_at?->toIso8601String(),
        ];
    }
}
