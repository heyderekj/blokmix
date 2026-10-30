<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A section of a library page: where it sits on the screenshot and the built-in layout it lands as when clipped. */
class LibrarySection extends Model
{
    /** core/types.ts SECTION_TYPES. */
    public const TYPES = ['nav', 'hero', 'header', 'logos', 'features', 'stats', 'content', 'gallery', 'team', 'testimonials', 'pricing', 'blog', 'faq', 'contact', 'cta', 'footer'];

    public const STATUSES = ['matched', 'needs_layout', 'hidden'];

    /** A built-in layout's clip id: "<type>.layout-<variant>" (or any "<type>.<folder>"). */
    public const LAYOUT_PATTERN = '/^[a-z]+\.[a-z0-9][a-z0-9-]{0,100}$/';

    protected $fillable = ['order', 'type', 'box', 'layout_id', 'score', 'status', 'screenshot', 'hint'];

    protected function casts(): array
    {
        return ['box' => 'array', 'hint' => 'array', 'score' => 'float'];
    }

    public function toApi(): array
    {
        return [
            'id' => $this->id,
            'order' => $this->order,
            'type' => $this->type,
            'box' => $this->box,
            'layoutId' => $this->layout_id,
            'score' => $this->score,
            'status' => $this->status,
            'screenshot' => $this->screenshot ? LibraryAsset::urlFor($this->screenshot) : null,
            'hint' => $this->hint,
        ];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(LibraryPage::class, 'library_page_id');
    }
}
