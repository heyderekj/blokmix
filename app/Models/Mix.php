<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A mix: its pages, style guide, words and notes in `data`, its versions as rows.
 */
class Mix extends Model
{
    use HasUlids;

    protected $fillable = ['name', 'data', 'schema'];

    protected $attributes = ['schema' => 1, 'lock_version' => 1];

    protected function casts(): array
    {
        return ['data' => 'array', 'schema' => 'integer', 'lock_version' => 'integer'];
    }

    public function versions(): HasMany
    {
        return $this->hasMany(MixVersion::class);
    }

    /** The mix as the board reads it. */
    public function toBoard(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'data' => $this->data,
            'versions' => $this->versions->mapWithKeys(fn (MixVersion $v) => [$v->key => $v->node])->all(),
            'lock' => $this->lock_version,
            'schema' => $this->schema,
        ];
    }
}
