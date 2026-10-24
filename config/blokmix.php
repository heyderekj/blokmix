<?php

return [
    /*
     * One shared password for the whole app until accounts land (phase 4d). Anyone with it can open and
     * edit every mix. In production the app stays closed until it's set; locally it's open when unset.
     */
    'password' => env('BLOKMIX_PASSWORD'),
];
