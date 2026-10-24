<?php

return [
    /*
     * Where uploads are kept. On Laravel Cloud, attach a bucket to the environment and make it the
     * default disk (or name it here); locally it's storage/app/private.
     */
    'uploads_disk' => env('BLOKMIX_UPLOADS_DISK', env('FILESYSTEM_DISK', 'local')),

    /** The largest upload: videos and Lotties are kept as they are (images are downscaled in the browser). */
    'upload_max_kb' => 40 * 1024,

    /** Unsplash's access key, kept on the server: the board searches through /api/unsplash. */
    'unsplash_key' => env('UNSPLASH_ACCESS_KEY'),
];
