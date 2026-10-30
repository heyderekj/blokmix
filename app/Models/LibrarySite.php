<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

/**
 * A real website in the site library, captured by the library CLI. Its screenshots are only for browsing (they link
 * back to the live site); a section clipped from it lands as the built-in layout it matched, never its words or images.
 */
class LibrarySite extends Model
{
    use HasUlids;

    public const STATUSES = ['draft', 'published'];

    /** The style guide effects a site can carry (core/treatments/effects.ts EFFECT_IDS). */
    public const EFFECTS = ['shadow', 'gradient', 'grain', 'glass', 'glow'];

    protected $fillable = ['slug', 'name', 'url', 'industry', 'tags', 'tokens', 'fonts', 'effects', 'personality', 'status'];

    protected $attributes = ['status' => 'draft', 'tags' => '[]', 'tokens' => '{}', 'fonts' => '[]'];

    protected function casts(): array
    {
        return ['tags' => 'array', 'tokens' => 'array', 'fonts' => 'array', 'effects' => 'array'];
    }

    public function pages(): HasMany
    {
        return $this->hasMany(LibraryPage::class)->orderBy('order');
    }

    public function sections(): HasManyThrough
    {
        return $this->hasManyThrough(LibrarySection::class, LibraryPage::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(LibraryAsset::class);
    }

    public function thumb(): HasOne
    {
        return $this->hasOne(LibraryAsset::class)->where('kind', 'thumb');
    }

    /** With what a card needs: its thumbnail and how many pages and sections it has (hidden ones aren't counted). */
    public function scopeForCards(Builder $query): void
    {
        $query->with('thumb')->withCount([
            'pages',
            'sections' => fn ($q) => $q->where('status', '!=', 'hidden'),
            'sections as matched_count' => fn ($q) => $q->where('status', 'matched'),
            'sections as needs_layout_count' => fn ($q) => $q->where('status', 'needs_layout'),
        ]);
    }

    /** A card in the library (scopeForCards). */
    public function summary(): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'url' => $this->url,
            'industry' => $this->industry,
            'tags' => $this->tags,
            'palette' => (object) $this->palette(),
            'effects' => array_keys($this->effects ?? []),
            'thumb' => $this->thumb?->url(),
            'status' => $this->status,
            'pages' => (int) $this->pages_count,
            'sections' => (int) $this->sections_count,
            'matched' => (int) $this->matched_count,
            'needsLayout' => (int) $this->needs_layout_count,
            'updated_at' => $this->updated_at,
        ];
    }

    /** Everything about it, page by page. Hidden sections only when asked (for the people who curate it). */
    public function full(bool $withHidden = false): array
    {
        $this->loadMissing(['thumb', 'pages.sections']);

        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'url' => $this->url,
            'industry' => $this->industry,
            'tags' => $this->tags,
            'tokens' => (object) ($this->tokens ?? []),
            'fonts' => $this->fonts,
            'effects' => (object) ($this->effects ?? []),
            'personality' => $this->personality,
            'status' => $this->status,
            'thumb' => $this->thumb?->url(),
            'updated_at' => $this->updated_at,
            'pages' => $this->pages->map(fn (LibraryPage $page) => [
                'id' => $page->id,
                'path' => $page->path,
                'title' => $page->title,
                'order' => $page->order,
                'screenshot' => $page->screenshot ? LibraryAsset::urlFor($page->screenshot) : null,
                'width' => $page->width,
                'height' => $page->height,
                'sections' => $page->sections
                    ->filter(fn (LibrarySection $s) => $withHidden || $s->status !== 'hidden')
                    ->map->toApi()->values(),
            ])->values(),
        ];
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    /** Where its files live on the uploads disk. */
    public function dir(): string
    {
        return 'library/'.$this->slug;
    }

    /** The colors and display font, enough to draw its palette on a card. */
    public function palette(): array
    {
        return collect($this->tokens ?? [])
            ->filter(fn ($v, $k) => str_starts_with($k, 'color.') || $k === 'font.display')
            ->all();
    }
}
