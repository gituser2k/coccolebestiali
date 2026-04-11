<?php

use App\Http\Controllers\MessageController;
use App\Http\Controllers\AdminController;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    $indexFile = base_path('../html/dist/index.html');

    if (! File::exists($indexFile)) {
        return response(
            'Homepage non compilata. Esegui "npm run build" nella cartella html.',
            Response::HTTP_SERVICE_UNAVAILABLE
        );
    }

    return response()->file($indexFile, [
        'Content-Type' => 'text/html; charset=UTF-8',
    ]);
});

Route::get('/index.html', function () {
    return redirect('/');
});

Route::get('/asset/{path}', function (string $path) {
    $base = realpath(base_path('../asset'));
    $file = realpath(base_path('../asset/'.$path));

    if (! $base || ! $file || ! str_starts_with($file, $base) || ! File::exists($file)) {
        abort(Response::HTTP_NOT_FOUND);
    }

    return response()->file($file);
})->where('path', '.*');

Route::get('/cmsadminsite', function () {
    $sourceLoginFile = base_path('../html/cmsadminsite.html');
    $distLoginFile = base_path('../html/dist/cmsadminsite.html');
    $loginFile = File::exists($sourceLoginFile) ? $sourceLoginFile : $distLoginFile;

    if (! File::exists($loginFile)) {
        return response(
            'Pagina login CMS non trovata. Verifica il file html/dist/cmsadminsite.html.',
            Response::HTTP_SERVICE_UNAVAILABLE
        );
    }

    return response()->file($loginFile, [
        'Content-Type' => 'text/html; charset=UTF-8',
    ]);
});

Route::middleware('api')
    ->withoutMiddleware([VerifyCsrfToken::class])
    ->prefix('api')
    ->group(function () {
    Route::get('/inertia-demo', function () {
        return Inertia::render('DemoPage', [
            'message' => 'Messaggio dal backend Laravel: modifica questo testo in routes/api.php****',
        ]);
    });

    Route::post('/messages', [MessageController::class, 'saveMessage']);

    Route::get('/admin/messages', [MessageController::class, 'getAdminMessages']);
    Route::get('/admin/errors', [AdminController::class, 'getAdminErrors']);
});
