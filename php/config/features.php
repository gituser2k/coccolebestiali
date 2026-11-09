<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Multi-profile account migration
    |--------------------------------------------------------------------------
    |
    | This flag is intentionally disabled during the compatibility migration.
    | New multi-profile behavior must remain unreachable until its milestone is
    | complete, tested and explicitly approved.
    |
    */
    'multi_profile' => [
        'enabled' => env('CB_MULTI_PROFILE_ENABLED', false),
    ],
];
