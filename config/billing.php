<?php

return [
    /*
     * Mix packs are sold through Polar (merchant of record), in Blokmix's own Polar organization. Until this is on,
     * nothing calls Polar and the buy button says packs are coming soon.
     */
    'enabled' => (bool) env('BLOKMIX_PRICING_ENABLED', false),

    'polar' => [
        'server' => env('POLAR_SERVER', 'production'), // production | sandbox
        'access_token' => env('POLAR_ACCESS_TOKEN'),
        'webhook_secret' => env('POLAR_WEBHOOK_SECRET'),
        // Our product keys to Polar product ids. A mix pack is one-time: three mixes (config/blokmix.php `pack`).
        'products' => [
            'mix_pack' => env('POLAR_PRODUCT_MIX_PACK'),
        ],
    ],
];
