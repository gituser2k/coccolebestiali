<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\PetAssistantSearchController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicPetAssistantController;
use App\Models\PublicPetAssistant;
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

Route::get('/search', function () {
    $file = base_path('../html/dist/src/html/search.html');
    if (! File::exists($file)) {
        return response('Pagina ricerca non compilata. Esegui "npm run build" nella cartella html.', Response::HTTP_SERVICE_UNAVAILABLE);
    }

    return response()->file($file, ['Content-Type' => 'text/html; charset=UTF-8']);
});

Route::get('/pet-assistants/{assistantId}', function (int $assistantId) {
    abort_unless((new PublicPetAssistant)->exists($assistantId), 404);
    $file = base_path('../html/dist/src/html/pet-assistant-detail.html');
    abort_unless(File::exists($file), 503, 'Profilo pubblico non compilato.');

    return response()->file($file, ['Content-Type' => 'text/html; charset=UTF-8']);
})->whereNumber('assistantId');

Route::prefix('api')->group(function () {
    Route::get('/pet-assistants/{assistantId}', [PublicPetAssistantController::class, 'show'])->whereNumber('assistantId');
    Route::get('/pet-assistants/{assistantId}/availability', [PublicPetAssistantController::class, 'availability'])->whereNumber('assistantId');
    Route::get('/pet-assistant-favorites', [PublicPetAssistantController::class, 'favorites']);
    Route::put('/pet-assistants/{assistantId}/favorite', [PublicPetAssistantController::class, 'setFavorite'])->whereNumber('assistantId');
    Route::get('/bookings/active-for-assistant', [BookingController::class, 'activeForAssistant']);
    Route::post('/bookings/batch', [BookingController::class, 'storeBatch']);
    Route::post('/bookings/{bookingId}/review', [BookingController::class, 'review'])->whereNumber('bookingId');
    Route::post('/profile/petassistant/operator', [ProfileController::class, 'savePetAssistantOperatorProfile']);
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
        Route::delete('/auth/account', [AuthController::class, 'deleteCurrentAccount']);
        Route::post('/auth/frontend-error', [AuthController::class, 'logFrontendError']);
        Route::post('/auth/login/email', [AuthController::class, 'loginEmail']);
        Route::post('/auth/login/google', [AuthController::class, 'loginGoogle']);
        Route::post('/auth/login/apple', [AuthController::class, 'loginApple']);
        Route::post('/auth/login/apple/mock', [AuthController::class, 'loginAppleMock']);
        Route::post('/auth/password/forgot', [AuthController::class, 'requestTemporaryPassword']);
        Route::post('/auth/password/temporary', [AuthController::class, 'completeTemporaryPassword']);
        Route::post('/auth/register/email', [AuthController::class, 'registerEmail']);
        Route::post('/auth/register/google', [AuthController::class, 'registerGoogle']);
        Route::post('/auth/register/apple', [AuthController::class, 'registerApple']);
        Route::post('/auth/register/apple/mock', [AuthController::class, 'registerAppleMock']);
        Route::post('/auth/account/email', [AuthController::class, 'changeCurrentAccountToEmail']);
        Route::post('/auth/account/google', [AuthController::class, 'changeCurrentAccountToGoogle']);
        Route::post('/auth/account/apple', [AuthController::class, 'changeCurrentAccountToApple']);
        Route::post('/auth/account/apple/mock', [AuthController::class, 'changeCurrentAccountToAppleMock']);
        Route::get('/auth/verify-email', [AuthController::class, 'verifyEmail']);
        Route::get('/profile/operator/options', [ProfileController::class, 'getOperatorOptions']);
        Route::get('/profile/cities', [ProfileController::class, 'searchItalianCities']);
        Route::get('/profile/geocode', [ProfileController::class, 'geocodeItalianAddress']);
        Route::get('/profile/petowner/personal', [ProfileController::class, 'getPetOwnerPersonalProfile']);
        Route::post('/profile/petowner/personal', [ProfileController::class, 'savePetOwnerPersonalProfile']);
        Route::post('/profile/petowner/password', [ProfileController::class, 'changePetOwnerPassword']);
        Route::get('/profile/petowner/pets/options', [ProfileController::class, 'getPetOwnerPetOptions']);
        Route::get('/profile/petowner/pets', [ProfileController::class, 'getPetOwnerPets']);
        Route::post('/profile/petowner/pets', [ProfileController::class, 'savePetOwnerPets']);
        Route::post('/profile/petowner/pets/profile-photo', [ProfileController::class, 'updatePetOwnerProfilePhoto']);
        Route::get('/profile/petowner/pets/documents/{documentId}', [ProfileController::class, 'downloadPetOwnerDocument'])
            ->whereNumber('documentId');
        Route::get('/profile/petassistant/personal', [ProfileController::class, 'getPetAssistantPersonalProfile']);
        Route::post('/profile/petassistant/personal', [ProfileController::class, 'savePetAssistantPersonalProfile']);
        Route::post('/profile/petassistant/password', [ProfileController::class, 'changePetAssistantPassword']);
        Route::get('/profile/petassistant/operator', [ProfileController::class, 'getPetAssistantOperatorProfile']);
        Route::get('/profile/petassistant/calendar', [ProfileController::class, 'getPetAssistantCalendarMonth']);
        Route::get('/profile/petassistant/calendar/day', [ProfileController::class, 'getPetAssistantCalendarDay']);
        Route::post('/profile/petassistant/calendar/day', [ProfileController::class, 'savePetAssistantCalendarDay']);
        Route::post('/profile/petassistant/calendar/copy', [ProfileController::class, 'copyPetAssistantCalendarDay']);
        Route::get('/search/pet-assistants/options', [PetAssistantSearchController::class, 'getOptions']);
        Route::post('/search/pet-assistants', [PetAssistantSearchController::class, 'search']);
        Route::get('/bookings', [BookingController::class, 'index']);
        Route::post('/bookings', [BookingController::class, 'store']);
        Route::post('/bookings/confirmation-mode', [BookingController::class, 'updateConfirmationMode']);
        Route::post('/bookings/{bookingId}/accept', [BookingController::class, 'accept'])->whereNumber('bookingId');
        Route::post('/bookings/{bookingId}/decline', [BookingController::class, 'decline'])->whereNumber('bookingId');
        Route::post('/bookings/{bookingId}/cancel', [BookingController::class, 'cancel'])->whereNumber('bookingId');
        Route::get('/bookings/{bookingId}/alternatives', [BookingController::class, 'alternatives'])->whereNumber('bookingId');
        Route::post('/bookings/{bookingId}/reschedule', [BookingController::class, 'proposeReschedule'])->whereNumber('bookingId');
        Route::post('/bookings/{bookingId}/reschedule/respond', [BookingController::class, 'respondReschedule'])->whereNumber('bookingId');
        Route::get('/bookings/action/{token}', [BookingController::class, 'showEmailAction'])->where('token', '[a-f0-9]{64}');
        Route::post('/bookings/action/{token}', [BookingController::class, 'consumeEmailAction'])->where('token', '[a-f0-9]{64}');

        Route::post('/admin/auth/login', [AdminController::class, 'login']);
        Route::post('/admin/auth/logout', [AdminController::class, 'logout']);
        Route::get('/admin/auth/session', [AdminController::class, 'session']);
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
        Route::get('/admin/policies', [AdminController::class, 'getAdminPolicies']);
        Route::post('/admin/policies', [AdminController::class, 'saveAdminPolicies']);
        Route::post('/admin/demo-data/restore-system', [AdminController::class, 'restoreSystemData']);
        Route::post('/admin/demo-data/clear-all', [AdminController::class, 'clearAllData']);
        Route::post('/admin/demo-data/seed', [AdminController::class, 'seedDemoData']);
    });
