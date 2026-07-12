<?php

use App\Http\Controllers\MessageController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

Route::get('/', function () {
    $indexFile = base_path('../html/dist/src/html/index.html');

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

Route::get('/register', function () {
    $registerFile = base_path('../html/dist/src/html/register.html');

    if (! File::exists($registerFile)) {
        return response(
            'Pagina registrazione non compilata. Esegui "npm run build" nella cartella html.',
            Response::HTTP_SERVICE_UNAVAILABLE
        );
    }

    return response()->file($registerFile, [
        'Content-Type' => 'text/html; charset=UTF-8',
    ]);
});

Route::get('/profile/petowner', function () {
    $file = base_path('../html/dist/src/html/profile-petowner.html');
    if (! File::exists($file)) {
        return response('Pagina profilo pet owner non compilata. Esegui "npm run build" nella cartella html.', Response::HTTP_SERVICE_UNAVAILABLE);
    }
    return response()->file($file, ['Content-Type' => 'text/html; charset=UTF-8']);
});

Route::get('/profile/petassistant', function () {
    $file = base_path('../html/dist/src/html/profile-petassistant.html');
    if (! File::exists($file)) {
        return response('Pagina profilo pet assistant non compilata. Esegui "npm run build" nella cartella html.', Response::HTTP_SERVICE_UNAVAILABLE);
    }
    return response()->file($file, ['Content-Type' => 'text/html; charset=UTF-8']);
});

Route::get('/asset/{path}', function (string $path) {
    $base = realpath(base_path('../asset'));
    $file = realpath(base_path('../asset/'.$path));

    if (! $base || ! $file || ! str_starts_with($file, $base) || ! File::exists($file)) {
        abort(Response::HTTP_NOT_FOUND);
    }

    return response()->file($file);
})->where('path', '.*');

Route::get('/storage/{path}', function (string $path) {
    $normalizedPath = ltrim($path, '/');

    if ($normalizedPath === '' || ! Storage::disk('public')->exists($normalizedPath)) {
        abort(Response::HTTP_NOT_FOUND);
    }

    return response()->file(Storage::disk('public')->path($normalizedPath));
})->where('path', '.*');

Route::get('/cmsadminsite', function () {
    $sourceLoginFile = base_path('../html/src/html/cmsadminsite.html');
    $distLoginFile = base_path('../html/dist/cmsadminsite.html');
    $loginFile = File::exists($sourceLoginFile) ? $sourceLoginFile : $distLoginFile;

    if (! File::exists($loginFile)) {
        return response(
            'Pagina login CMS non trovata. Verifica il file html/src/html/cmsadminsite.html o html/dist/cmsadminsite.html.',
            Response::HTTP_SERVICE_UNAVAILABLE
        );
    }

    return response()->file($loginFile, [
        'Content-Type' => 'text/html; charset=UTF-8',
    ]);
});

Route::get('/utility.js', function () {
    $utilityFile = base_path('../html/src/utility.js');

    if (! File::exists($utilityFile)) {
        abort(Response::HTTP_NOT_FOUND);
    }

    return response()->file($utilityFile, [
        'Content-Type' => 'application/javascript; charset=UTF-8',
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
    Route::get('/auth/config', [AuthController::class, 'getPublicAuthConfig']);
    Route::get('/auth/me', [AuthController::class, 'getCurrentUser']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/frontend-error', [AuthController::class, 'logFrontendError']);
    Route::post('/auth/login/email', [AuthController::class, 'loginEmail']);
    Route::post('/auth/login/google', [AuthController::class, 'loginGoogle']);
    Route::post('/auth/login/apple', [AuthController::class, 'loginApple']);
    Route::post('/auth/login/apple/mock', [AuthController::class, 'loginAppleMock']);
    Route::post('/auth/register/email', [AuthController::class, 'registerEmail']);
    Route::post('/auth/register/google', [AuthController::class, 'registerGoogle']);
    Route::post('/auth/register/apple', [AuthController::class, 'registerApple']);
    Route::post('/auth/register/apple/mock', [AuthController::class, 'registerAppleMock']);
    Route::get('/auth/verify-email', [AuthController::class, 'verifyEmail']);
    Route::get('/profile/languages', [ProfileController::class, 'getLanguages']);
    Route::get('/profile/operator/options', [ProfileController::class, 'getOperatorOptions']);
    Route::get('/profile/cities', [ProfileController::class, 'searchItalianCities']);
    Route::get('/profile/geocode', [ProfileController::class, 'geocodeItalianAddress']);
    Route::get('/profile/petassistant/personal', [ProfileController::class, 'getPetAssistantPersonalProfile']);
    Route::post('/profile/petassistant/personal', [ProfileController::class, 'savePetAssistantPersonalProfile']);
    Route::get('/profile/petassistant/operator', [ProfileController::class, 'getPetAssistantOperatorProfile']);
    Route::post('/profile/petassistant/operator', [ProfileController::class, 'savePetAssistantOperatorProfile']);
    Route::get('/profile/petassistant/calendar', [ProfileController::class, 'getPetAssistantCalendarMonth']);
    Route::get('/profile/petassistant/calendar/day', [ProfileController::class, 'getPetAssistantCalendarDay']);
    Route::post('/profile/petassistant/calendar/day', [ProfileController::class, 'savePetAssistantCalendarDay']);
    Route::post('/profile/petassistant/calendar/copy', [ProfileController::class, 'copyPetAssistantCalendarDay']);

    Route::get('/admin/messages', [MessageController::class, 'getAdminMessages']);
    Route::get('/admin/messages/{messageId}/reply', [MessageController::class, 'getLastAdminMessageReply']);
    Route::delete('/admin/messages', [MessageController::class, 'deleteAdminMessages']);
    Route::post('/admin/messages/reply', [MessageController::class, 'replyAdminMessage']);
    Route::get('/admin/errors', [AdminController::class, 'getAdminErrors']);
    Route::delete('/admin/errors', [AdminController::class, 'deleteAdminErrors']);
    Route::get('/admin/services', [AdminController::class, 'getAdminServices']);
    Route::post('/admin/services', [AdminController::class, 'saveAdminService']);
    Route::delete('/admin/services/{serviceId}', [AdminController::class, 'deleteAdminService']);
    Route::delete('/admin/services/{serviceId}/features/{featureId}', [AdminController::class, 'detachAdminServiceFeature']);
    Route::get('/admin/service-features', [AdminController::class, 'getAdminFeatures']);
    Route::post('/admin/service-features', [AdminController::class, 'saveAdminFeature']);
    Route::delete('/admin/service-features/{featureId}', [AdminController::class, 'deleteAdminFeature']);
    Route::delete('/admin/service-features/{featureId}/services', [AdminController::class, 'detachAdminFeatureFromAllServices']);
    Route::get('/admin/pet-types', [AdminController::class, 'getAdminPetTypes']);
    Route::post('/admin/pet-types', [AdminController::class, 'saveAdminPetType']);
    Route::post('/admin/pet-types/reorder', [AdminController::class, 'reorderAdminPetTypes']);
    Route::delete('/admin/pet-types/{petTypeId}', [AdminController::class, 'deleteAdminPetType']);
    Route::get('/admin/house-features', [AdminController::class, 'getAdminHouseFeatures']);
    Route::post('/admin/house-features', [AdminController::class, 'saveAdminHouseFeature']);
    Route::post('/admin/house-features/reorder', [AdminController::class, 'reorderAdminHouseFeatures']);
    Route::delete('/admin/house-features/{houseFeatureId}', [AdminController::class, 'deleteAdminHouseFeature']);
});
