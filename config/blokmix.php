<?php

return [
    /*
     * Where uploads are kept. On Laravel Cloud, attach a bucket to the environment and make it the
     * default disk (or name it here); locally it's storage/app/private.
     */
    'uploads_disk' => env('BLOKMIX_UPLOADS_DISK', env('FILESYSTEM_DISK', 'local')),

    /** The largest upload: videos and Lotties are kept as they are (images are downscaled in the browser). */
    'upload_max_kb' => 40 * 1024,

    /**
     * What each plan includes. Null is unlimited. Free has one mix; mix packs (bought once, never renewed) hold three
     * mixes each, stack, and open everything else. Mixes are slots: archiving one frees it. Mixes and uploads count
     * against the mix's owner; clips against whoever saved them; collections and entries per collection (provisional
     * numbers) against the collection's owner. Shared mixes, built-in layouts and placeholder art never count. The
     * people who run Blokmix (owners, below) and accounts given `plan = plus` by hand have no mix limit.
     */
    'plans' => [
        'free' => ['mixes' => 1, 'clips' => 40, 'upload_mb' => 100, 'collections' => 1, 'entries' => 25],
        'paid' => ['mixes' => null, 'clips' => null, 'upload_mb' => 10 * 1024, 'collections' => null, 'entries' => null],
    ],

    /** A mix pack: one-time, three mixes. */
    'pack' => ['mixes' => 3, 'price_usd' => 20],

    /** Unsplash's access key, kept on the server: the board searches through /api/unsplash. */
    'unsplash_key' => env('UNSPLASH_ACCESS_KEY'),

    /**
     * Who runs Blokmix: these accounts see the waitlist (/waitlist). Comma-separated emails in BLOKMIX_OWNERS;
     * without it, Derek's account.
     */
    'owners' => array_values(array_filter(array_map(
        fn ($e) => strtolower(trim($e)),
        explode(',', (string) env('BLOKMIX_OWNERS', 'derekj@hey.com')),
    ))),
];
