<?php

return [
    /*
     * Plus is sold through Polar (merchant of record), in Blokmix's own Polar organization. Until this is on, nothing
     * calls Polar and the buy button says Plus opens at launch.
     */
    'enabled' => (bool) env('BLOKMIX_PRICING_ENABLED', false),

    'polar' => [
        'server' => env('POLAR_SERVER', 'production'), // production | sandbox
        'access_token' => env('POLAR_ACCESS_TOKEN'),
        'webhook_secret' => env('POLAR_WEBHOOK_SECRET'),
        // Our product keys to Polar product ids. Plus is one-time (config/blokmix.php `plus`).
        'products' => [
            'plus' => env('POLAR_PRODUCT_PLUS'),
        ],
    ],
];
