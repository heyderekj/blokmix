<?php

namespace App\Enums;

/** What a member can do with a mix. */
enum MixRole: string
{
    case Owner = 'owner';
    case Editor = 'editor';
    case Viewer = 'viewer';

    public function canEdit(): bool
    {
        return $this !== self::Viewer;
    }

    /** Higher is more: joining through a link never takes access away. */
    public function rank(): int
    {
        return match ($this) {
            self::Owner => 3,
            self::Editor => 2,
            self::Viewer => 1,
        };
    }
}
