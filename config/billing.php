<?php

return [
    /*
     * Sites are sold through Polar (merchant of record), in Blokmix's own Polar organization: $30 once per mix
     * (config/blokmix.php `site`). Until this is on, nothing calls Polar and the buy sheet says paying opens at launch.
     */
    'enabled' => (bool) env('BLOKMIX_PRICING_ENABLED', false),

    'polar' => [
        'server' => env('POLAR_SERVER', 'production'), // production | sandbox
        'access_token' => env('POLAR_ACCESS_TOKEN'),
        'webhook_secret' => env('POLAR_WEBHOOK_SECRET'),
        // Our product keys to Polar product ids. `site` is the one sold: one-time, $30, paying for one mix.
        // `plus` is the old one-time Plus ($25), no longer sold; kept so its orders' refunds still find it.
        'products' => [
            'site' => env('POLAR_PRODUCT_SITE'),
            'plus' => env('POLAR_PRODUCT_PLUS'),
        ],
    ],
];
