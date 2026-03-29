<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/inertia-demo', function () {
    return Inertia::render('DemoPage', [
        'message' => 'Messaggio dal backend Laravel: modifica questo testo in routes/api.php****',
    ]);
});
