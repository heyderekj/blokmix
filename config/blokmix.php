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
     * Free to make, $30 a site when you ship it (docs/pricing.md). Everything in the app is free; paying is once per mix,
     * and opens downloading its code and handing it to an agent, for every version of it from then on. Storage is a
     * guardrail, never printed as a feature: 100 MB per owner, 10 GB once they have paid for a site (or have Plus).
     * Uploads count against the mix's owner; shared mixes, built-in layouts and placeholder art never count.
     */
    'site' => ['price_usd' => 30],
    'upload_mb' => ['default' => 100, 'paid' => 10 * 1024],

    /**
     * While Blokmix is on a waitlist, nobody hits a paywall: every mix ships free (and every account counts as Plus).
     * Set BLOKMIX_WAITLIST_MODE=false when paying opens.
     */
    'waitlist_mode' => (bool) env('BLOKMIX_WAITLIST_MODE', true),

    /**
     * Where published mixes live (blok.page/<code>/<slug>): a separate site, so the pages people make never run on
     * blokmix.com beside its session cookie. Locally http://blok.localhost:8000 (php artisan serve answers on any host).
     */
    'publish_url' => $publishUrl = rtrim((string) env('BLOKMIX_PUBLISH_URL', env('APP_ENV') === 'local' ? 'http://blok.localhost:8000' : 'https://blok.page'), '/'),
    'publish_host' => parse_url($publishUrl, PHP_URL_HOST),

    /**
     * Where Blokmix itself lives, for blok.page's links back (its home and its notices) and the frames allowed to show
     * a published page. Not APP_URL: Laravel Cloud may set that to whichever custom domain it takes as primary.
     */
    'home_url' => rtrim((string) env('BLOKMIX_HOME_URL', env('APP_ENV') === 'local' ? env('APP_URL', 'http://localhost:8000') : 'https://blokmix.com'), '/'),

    /** Unsplash's access key, kept on the server: the board searches through /api/unsplash. */
    'unsplash_key' => env('UNSPLASH_ACCESS_KEY'),

    /**
     * TypeSafe's key for Jev (console.typesafe.ai/keys), kept on the server: the board asks through /api/jev. Without
     * it Jev is off and every feature that uses it falls back to what Blokmix did before.
     */
    'jev_key' => env('TYPESAFE_API_KEY'),

    /**
     * The reader: a small Claude model (Anthropic) that reads what people write (the start's sentence, a pasted
     * paragraph) into the same picks the board offers, and never writes words (resources/reader, /api/read). Without
     * the key it's off and the start reads with keywords and Jev, as before. Reading is included for everyone; these
     * caps are guardrails, like storage: 20 reads a minute and 200 a day per person (throttle:read), and a site-wide
     * number a day.
     */
    'read_key' => env('ANTHROPIC_API_KEY'),
    'read_model' => env('BLOKMIX_READ_MODEL', 'claude-haiku-5-5'),
    'read_daily_cap' => (int) env('BLOKMIX_READ_DAILY_CAP', 20000),
    /** Seconds to wait for a read before the board keeps what it has. */
    'read_timeout' => (float) env('BLOKMIX_READ_TIMEOUT', 12),

    /**
     * Who runs Blokmix: these accounts see the waitlist (/waitlist) and, like Plus, ship every mix they own free.
     * Comma-separated emails in BLOKMIX_OWNERS; without it, Derek's account.
     */
    'owners' => array_values(array_filter(array_map(
        fn ($e) => strtolower(trim($e)),
        explode(',', (string) env('BLOKMIX_OWNERS', 'derekj@hey.com')),
    ))),
];
