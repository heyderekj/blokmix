<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One page of a library site: its full-page screenshot and the sections found on it. */
class LibraryPage extends Model
{
    protected $fillable = ['path', 'title', 'order', 'screenshot', 'width', 'height'];

    public function site(): BelongsTo
    {
        return $this->belongsTo(LibrarySite::class, 'library_site_id');
    }

    public function sections(): HasMany
    {
        return $this->hasMany(LibrarySection::class)->orderBy('order');
    }
}
