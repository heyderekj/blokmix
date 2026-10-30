<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One upload a collection's entries use, stored on the uploads disk. */
class CollectionAsset extends Model
{
    protected $fillable = ['key', 'kind', 'name', 'mime', 'width', 'height', 'size', 'path', 'poster_path'];

    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    public function toBoard(): array
    {
        return ['id' => $this->key, 'kind' => $this->kind, 'name' => $this->name, 'mime' => $this->mime, 'width' => $this->width, 'height' => $this->height, 'size' => $this->size, 'poster' => $this->poster_path !== null];
    }
}
