<?php

namespace App\Mcp;

use App\Mcp\Tools\GetHandoff;
use App\Mcp\Tools\SubmitChanges;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;

#[Name('Blokmix')]
#[Instructions('Use the handoff ID the person sent. Read its packet and return schema, update their implementation, then submit a reviewable return.')]
class Blokmix extends Server
{
    protected array $tools = [GetHandoff::class, SubmitChanges::class];
}
