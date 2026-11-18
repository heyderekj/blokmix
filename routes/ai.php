<?php

use App\Mcp\Blokmix;
use Laravel\Mcp\Facades\Mcp;
use Laravel\Passport\Http\Middleware\CheckToken;

Mcp::oauthRoutes();
Mcp::web('/api/mcp', Blokmix::class)->middleware(['auth:api', CheckToken::using('mcp:use'), 'throttle:90,1']);
