<?php

namespace App\Policies;

use App\Enums\MixRole;
use App\Models\Mix;
use App\Models\User;

/** Members see a mix; owners and editors change it; viewers only leave marks; owners share and delete. */
class MixPolicy
{
    public function view(User $user, Mix $mix): bool
    {
        return $mix->roleOf($user) !== null;
    }

    /** Changing anything (viewers' saves are trimmed to their marks instead, see MixApiController). */
    public function update(User $user, Mix $mix): bool
    {
        return (bool) $mix->roleOf($user)?->canEdit();
    }

    public function share(User $user, Mix $mix): bool
    {
        return $mix->roleOf($user) === MixRole::Owner;
    }

    public function delete(User $user, Mix $mix): bool
    {
        return $mix->roleOf($user) === MixRole::Owner;
    }
}
