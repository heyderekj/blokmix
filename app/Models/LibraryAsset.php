<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/** A library site's screenshot (full page, section crop or thumbnail) on the uploads disk. Never counts toward anyone's room. */
class LibraryAsset extends Model
{
    public const KINDS = ['full', 'section', 'thumb'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'kind', 'name', 'mime', 'size', 'width', 'height', 'path'];

    public static function newId(): string
    {
        return 'ls_'.Str::lower(Str::random(8));
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(LibrarySite::class, 'library_site_id');
    }

    public function url(): string
    {
        return self::urlFor($this->id);
    }

    public static function urlFor(string $id): string
    {
        return '/api/library/assets/'.$id;
    }
}
