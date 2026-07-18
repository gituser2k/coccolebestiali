<?php

namespace App\Http\Controllers;

use App\Models\UserAccount;
use App\Models\Utility;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

class AuthController extends Controller
{
    private const PORTAL_USER_ID_COOKIE = 'cb_portal_user_id';
    private const PORTAL_USER_ROLE_COOKIE = 'cb_portal_user_role';

    public function getPublicAuthConfig(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => [
                'googleClientId' => (string) env('GOOGLE_CLIENT_ID', ''),
                'appleClientId' => (string) env('APPLE_CLIENT_ID', ''),
                'appleRedirectUri' => (string) env('APPLE_REDIRECT_URI', ''),
                'appleMockAuth' => $this->isAppleMockEnabled(),
            ],
        ], 200);
    }

    public function logFrontendError(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'context' => ['required', 'string', 'max:255'],
                'message' => ['required', 'string', 'max:4096'],
                'details' => ['nullable'],
            ]);

            $context = trim((string) $validated['context']);
            $message = trim((string) $validated['message']);
            $details = $validated['details'] ?? [];
            $params = [
                'context' => $context,
                'details' => is_array($details) ? $details : ['value' => $details],
            ];

            Utility::saveError($params, $message, __METHOD__);

            return response()->json([
                'ok' => true,
            ], 200);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function registerEmail(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'role' => ['required', 'string'],
                'email' => ['required', 'email', 'max:255'],
                'password' => [
                    'required',
                    'string',
                    'min:10',
                    'max:255',
                    'regex:/[A-Z]/',
                    'regex:/[a-z]/',
                    'regex:/[0-9]/',
                    'regex:/[^A-Za-z0-9\\s]/',
                    'not_regex:/\\s/',
                ],
            ], [
                'password.min' => 'La password deve contenere almeno 10 caratteri.',
                'password.regex' => 'La password deve contenere almeno una maiuscola, una minuscola, un numero e un simbolo.',
                'password.not_regex' => 'La password non puo contenere spazi.',
            ]);

            $role = $this->normalizeRole($validated['role']);
            $m = new UserAccount();
            $email = strtolower((string) $validated['email']);
            $user = $m->registerEmailUser($role, $email, (string) $validated['password']);
            $this->sendRegistrationEmailConfirmation($email, $role);

            return response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                ],
            ], 200);
        } catch (RuntimeException $e) {
            if ($e->getMessage() === 'EMAIL_ALREADY_EXISTS') {
                return response()->json([
                    'ok' => false,
                    'message' => 'Email gia registrata.',
                ], 409);
            }

            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function loginEmail(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'email' => ['required', 'email', 'max:255'],
                'password' => ['required', 'string', 'max:255'],
            ]);

            $model = new UserAccount();
            $user = $model->authenticateEmailUser(
                strtolower((string) $validated['email']),
                (string) $validated['password']
            );

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                    'redirect' => $this->profileRedirectPathForRoleAndEntry((string) ($user['role'] ?? ''), 'login'),
                ],
            ], 200), $user);
        } catch (RuntimeException $e) {
            $message = match ($e->getMessage()) {
                'LOGIN_USER_NOT_FOUND' => 'Account non trovato.',
                'LOGIN_PASSWORD_INVALID' => 'Password non corretta.',
                'LOGIN_EMAIL_NOT_VERIFIED' => 'Email non ancora confermata.',
                default => 'Login non riuscito.',
            };

            if (! in_array($e->getMessage(), ['LOGIN_USER_NOT_FOUND', 'LOGIN_PASSWORD_INVALID', 'LOGIN_EMAIL_NOT_VERIFIED'], true)) {
                Utility::saveError($validated, $e->getMessage(), __METHOD__);
            }

            return response()->json([
                'ok' => false,
                'message' => $message,
            ], 422);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function requestTemporaryPassword(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'email' => ['required', 'email', 'max:255'],
            ]);

            $email = strtolower((string) $validated['email']);
            $temporaryPassword = $this->generateTemporaryPassword();

            $model = new UserAccount();
            $user = $model->createTemporaryPassword($email, $temporaryPassword);

            if ($user !== []) {
                $this->sendTemporaryPasswordEmail($email, $temporaryPassword);
            }

            return response()->json([
                'ok' => true,
                'message' => 'Password temporanea inviata',
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function completeTemporaryPassword(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Utente non autenticato.',
                ], Response::HTTP_OK);
            }

            $validated = $request->validate([
                'password' => [
                    'required',
                    'string',
                    'min:10',
                    'max:255',
                    'regex:/[A-Z]/',
                    'regex:/[a-z]/',
                    'regex:/[0-9]/',
                    'regex:/[^A-Za-z0-9\\s]/',
                    'not_regex:/\\s/',
                ],
                'password_confirmation' => ['required', 'same:password'],
            ], [
                'password.min' => 'La password deve contenere almeno 10 caratteri.',
                'password.regex' => 'La password deve contenere almeno una maiuscola, una minuscola, un numero e un simbolo.',
                'password.not_regex' => 'La password non puo contenere spazi.',
                'password_confirmation.same' => 'Le password inserite non coincidono.',
            ]);

            $model = new UserAccount();
            $user = $model->completeTemporaryPasswordChange($userId, (string) $validated['password']);

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                    'redirect' => $this->profileRedirectPathForRoleAndEntry((string) ($user['role'] ?? ''), 'login'),
                ],
                'message' => 'Password aggiornata con successo.',
            ], Response::HTTP_OK), $user);
        } catch (RuntimeException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Cambio password non completato.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function registerGoogle(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'role' => ['required', 'string'],
                'idToken' => ['nullable', 'string'],
                'accessToken' => ['nullable', 'string'],
            ]);

            $role = $this->normalizeRole($validated['role']);
            $idToken = trim((string) ($validated['idToken'] ?? ''));
            $accessToken = trim((string) ($validated['accessToken'] ?? ''));

            if ($idToken !== '') {
                $claims = $this->verifyGoogleIdToken($idToken);
            } elseif ($accessToken !== '') {
                $claims = $this->verifyGoogleAccessToken($accessToken);
            } else {
                throw new RuntimeException('GOOGLE_TOKEN_MISSING');
            }

            $m = new UserAccount();
            $user = $m->upsertSocialUser(
                'google',
                $claims['sub'],
                $role,
                $claims['email'],
                $claims['emailVerified'],
                $claims['name'],
                $claims['avatar'],
                false,
                $claims['rawClaims']
            );

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                ],
            ], 200), $user);
        } catch (RuntimeException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Registrazione Google non valida.',
            ], 422);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function loginGoogle(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'idToken' => ['nullable', 'string'],
                'accessToken' => ['nullable', 'string'],
            ]);

            $idToken = trim((string) ($validated['idToken'] ?? ''));
            $accessToken = trim((string) ($validated['accessToken'] ?? ''));

            if ($idToken !== '') {
                $claims = $this->verifyGoogleIdToken($idToken);
            } elseif ($accessToken !== '') {
                $claims = $this->verifyGoogleAccessToken($accessToken);
            } else {
                throw new RuntimeException('GOOGLE_TOKEN_MISSING');
            }

            $model = new UserAccount();
            $user = $model->loginSocialUser('google', (string) $claims['sub'], (string) ($claims['email'] ?? ''));

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                    'redirect' => $this->profileRedirectPathForRoleAndEntry((string) ($user['role'] ?? ''), 'login'),
                ],
            ], 200), $user);
        } catch (RuntimeException $e) {
            $message = match ($e->getMessage()) {
                'LOGIN_SOCIAL_USER_NOT_FOUND' => 'Account Google non trovato. Registrati prima.',
                default => 'Login Google non valido.',
            };

            if (! in_array($e->getMessage(), ['LOGIN_SOCIAL_USER_NOT_FOUND'], true)) {
                Utility::saveError($validated, $e->getMessage(), __METHOD__);
            }

            return response()->json([
                'ok' => false,
                'message' => $message,
            ], 422);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function changeCurrentAccountToEmail(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Utente non autenticato.',
                ], Response::HTTP_OK);
            }

            $validated = $request->validate([
                'email' => ['required', 'email', 'max:255'],
                'password' => [
                    'required',
                    'string',
                    'min:10',
                    'max:255',
                    'regex:/[A-Z]/',
                    'regex:/[a-z]/',
                    'regex:/[0-9]/',
                    'regex:/[^A-Za-z0-9\\s]/',
                    'not_regex:/\\s/',
                ],
            ], [
                'password.min' => 'La password deve contenere almeno 10 caratteri.',
                'password.regex' => 'La password deve contenere almeno una maiuscola, una minuscola, un numero e un simbolo.',
                'password.not_regex' => 'La password non puo contenere spazi.',
            ]);

            $model = new UserAccount();
            $user = $model->switchCurrentUserToEmail(
                $userId,
                strtolower((string) $validated['email']),
                (string) $validated['password']
            );

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                ],
                'message' => 'Account aggiornato con successo.',
            ], Response::HTTP_OK), $user);
        } catch (RuntimeException $e) {
            if ($e->getMessage() !== 'EMAIL_ALREADY_EXISTS') {
                Utility::saveError($validated, $e->getMessage(), __METHOD__);
            }

            return response()->json([
                'ok' => false,
                'message' => $e->getMessage() === 'EMAIL_ALREADY_EXISTS'
                    ? 'Email gia registrata.'
                    : 'Cambio account non completato.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function changeCurrentAccountToGoogle(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Utente non autenticato.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'idToken' => ['nullable', 'string'],
                'accessToken' => ['nullable', 'string'],
            ]);

            $idToken = trim((string) ($validated['idToken'] ?? ''));
            $accessToken = trim((string) ($validated['accessToken'] ?? ''));

            if ($idToken !== '') {
                $claims = $this->verifyGoogleIdToken($idToken);
            } elseif ($accessToken !== '') {
                $claims = $this->verifyGoogleAccessToken($accessToken);
            } else {
                throw new RuntimeException('GOOGLE_TOKEN_MISSING');
            }

            $model = new UserAccount();
            $user = $model->switchCurrentUserToSocial(
                $userId,
                'google',
                (string) $claims['sub'],
                (string) $claims['email'],
                (bool) $claims['emailVerified'],
                (string) $claims['name'],
                (string) $claims['avatar'],
                false,
                (array) $claims['rawClaims']
            );

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                ],
                'message' => 'Account Google aggiornato con successo.',
            ], Response::HTTP_OK), $user);
        } catch (RuntimeException $e) {
            if (! in_array($e->getMessage(), ['EMAIL_ALREADY_EXISTS', 'SOCIAL_ACCOUNT_ALREADY_LINKED'], true)) {
                Utility::saveError($validated, $e->getMessage(), __METHOD__);
            }

            $message = match ($e->getMessage()) {
                'EMAIL_ALREADY_EXISTS' => 'Email gia registrata.',
                'SOCIAL_ACCOUNT_ALREADY_LINKED' => 'Account Google gia associato a un altro utente.',
                default => 'Cambio account Google non completato.',
            };

            return response()->json([
                'ok' => false,
                'message' => $message,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function verifyEmail(Request $request)
    {
        $email = strtolower(trim((string) $request->query('email', '')));
        $role = strtolower(trim((string) $request->query('role', '')));
        $expires = (int) $request->query('expires', 0);
        $signature = (string) $request->query('signature', '');

        $expected = hash_hmac('sha256', $email.'|'.$role.'|'.$expires, (string) config('app.key'));

        if ($email === '' || $role === '' || $expires <= time() || ! hash_equals($expected, $signature)) {
            return response($this->emailVerificationHtml(false), 400)
                ->header('Content-Type', 'text/html; charset=UTF-8');
        }

        $m = new UserAccount();
        $m->markEmailAsVerified($email);
        $user = $m->getUserByEmail($email);

        if ($user === []) {
            return response($this->emailVerificationHtml(false), 400)
                ->header('Content-Type', 'text/html; charset=UTF-8');
        }

        return $this->withPortalUserCookies(
            redirect()->to($this->profileRedirectPathForRoleAndEntry($role, 'register')),
            $user
        );
    }

    public function getCurrentUser(Request $request): JsonResponse
    {
        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Utente non autenticato.',
                ], Response::HTTP_OK);
            }

            $model = new UserAccount();
            $user = $model->getUserById($userId);

            if ($user === []) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Utente non trovato.',
                ], Response::HTTP_OK);
            }

            return response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                ],
            ], Response::HTTP_OK);
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function logout(Request $request): JsonResponse
    {
        try {
            if ($request->hasSession()) {
                $request->session()->forget([
                    self::PORTAL_USER_ID_COOKIE,
                    self::PORTAL_USER_ROLE_COOKIE,
                ]);
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            return response()->json([
                'ok' => true,
            ], Response::HTTP_OK)
                ->withCookie(Cookie::forget(self::PORTAL_USER_ID_COOKIE, '/', null))
                ->withCookie(Cookie::forget(self::PORTAL_USER_ROLE_COOKIE, '/', null));
        } catch (QueryException $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError([], $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function registerApple(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'role' => ['required', 'string'],
                'identityToken' => ['required', 'string'],
                'user' => ['nullable'],
            ]);

            $role = $this->normalizeRole($validated['role']);
            $claims = $this->verifyAppleIdentityToken(
                (string) $validated['identityToken'],
                $validated['user'] ?? null
            );

            $m = new UserAccount();
            $user = $m->upsertSocialUser(
                'apple',
                $claims['sub'],
                $role,
                $claims['email'],
                $claims['emailVerified'],
                $claims['name'],
                '',
                $claims['isPrivateEmail'],
                $claims['rawClaims']
            );

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                ],
            ], 200), $user);
        } catch (RuntimeException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Registrazione Apple non valida.',
            ], 422);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function loginApple(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $validated = $request->validate([
                'identityToken' => ['required', 'string'],
                'user' => ['nullable'],
            ]);

            $claims = $this->verifyAppleIdentityToken(
                (string) $validated['identityToken'],
                $validated['user'] ?? null
            );

            $model = new UserAccount();
            $user = $model->loginSocialUser('apple', (string) $claims['sub'], (string) ($claims['email'] ?? ''));

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                    'redirect' => $this->profileRedirectPathForRoleAndEntry((string) ($user['role'] ?? ''), 'login'),
                ],
            ], 200), $user);
        } catch (RuntimeException $e) {
            $message = match ($e->getMessage()) {
                'LOGIN_SOCIAL_USER_NOT_FOUND' => 'Account Apple non trovato. Registrati prima.',
                default => 'Login Apple non valido.',
            };

            if (! in_array($e->getMessage(), ['LOGIN_SOCIAL_USER_NOT_FOUND'], true)) {
                Utility::saveError($validated, $e->getMessage(), __METHOD__);
            }

            return response()->json([
                'ok' => false,
                'message' => $message,
            ], 422);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function changeCurrentAccountToApple(Request $request): JsonResponse
    {
        $validated = [];

        try {
            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Utente non autenticato.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'identityToken' => ['required', 'string'],
                'user' => ['nullable'],
            ]);

            $claims = $this->verifyAppleIdentityToken(
                (string) $validated['identityToken'],
                $validated['user'] ?? null
            );

            $model = new UserAccount();
            $user = $model->switchCurrentUserToSocial(
                $userId,
                'apple',
                (string) $claims['sub'],
                (string) $claims['email'],
                (bool) $claims['emailVerified'],
                (string) $claims['name'],
                '',
                (bool) $claims['isPrivateEmail'],
                (array) $claims['rawClaims']
            );

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                ],
                'message' => 'Account Apple aggiornato con successo.',
            ], Response::HTTP_OK), $user);
        } catch (RuntimeException $e) {
            if (! in_array($e->getMessage(), ['EMAIL_ALREADY_EXISTS', 'SOCIAL_ACCOUNT_ALREADY_LINKED'], true)) {
                Utility::saveError($validated, $e->getMessage(), __METHOD__);
            }

            $message = match ($e->getMessage()) {
                'EMAIL_ALREADY_EXISTS' => 'Email gia registrata.',
                'SOCIAL_ACCOUNT_ALREADY_LINKED' => 'Account Apple gia associato a un altro utente.',
                default => 'Cambio account Apple non completato.',
            };

            return response()->json([
                'ok' => false,
                'message' => $message,
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    public function registerAppleMock(Request $request): JsonResponse
    {
        $validated = [];

        try {
            if (! app()->environment('local') || ! $this->isAppleMockEnabled()) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Apple mock auth non abilitato.',
                ], 403);
            }

            $validated = $request->validate([
                'role' => ['required', 'string'],
                'mockEmail' => ['nullable', 'email', 'max:255'],
                'mockName' => ['nullable', 'string', 'max:255'],
                'mockSub' => ['nullable', 'string', 'max:255'],
            ]);

            $role = $this->normalizeRole($validated['role']);
            $email = strtolower((string) ($validated['mockEmail'] ?? ''));
            $name = trim((string) ($validated['mockName'] ?? 'Apple Mock User'));
            $sub = trim((string) ($validated['mockSub'] ?? ''));

            if ($sub === '') {
                $sub = 'apple_mock_'.sha1(($email !== '' ? $email : $name).'|'.$role);
            }

            $claims = [
                'iss' => 'https://appleid.apple.com',
                'aud' => (string) env('APPLE_CLIENT_ID', 'apple.mock.local'),
                'sub' => $sub,
                'email' => $email,
                'email_verified' => 'true',
                'is_private_email' => 'true',
                'mock' => true,
            ];

            $m = new UserAccount();
            $user = $m->upsertSocialUser(
                'apple',
                $sub,
                $role,
                $email,
                true,
                $name,
                '',
                true,
                $claims
            );

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                    'mock' => true,
                ],
            ], 200), $user);
        } catch (RuntimeException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Registrazione Apple mock non valida.',
            ], 422);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function loginAppleMock(Request $request): JsonResponse
    {
        $validated = [];

        try {
            if (! app()->environment('local') || ! $this->isAppleMockEnabled()) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Apple mock auth non abilitato.',
                ], 403);
            }

            $validated = $request->validate([
                'mockSub' => ['nullable', 'string', 'max:255'],
                'mockEmail' => ['nullable', 'email', 'max:255'],
            ]);

            $mockSub = trim((string) ($validated['mockSub'] ?? ''));
            $mockEmail = strtolower(trim((string) ($validated['mockEmail'] ?? '')));

            $model = new UserAccount();
            $user = $model->loginSocialUser('apple', $mockSub, $mockEmail);

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                    'redirect' => $this->profileRedirectPathForRoleAndEntry((string) ($user['role'] ?? ''), 'login'),
                    'mock' => true,
                ],
            ], 200), $user);
        } catch (RuntimeException $e) {
            $message = match ($e->getMessage()) {
                'LOGIN_SOCIAL_USER_NOT_FOUND' => 'Account Apple non trovato. Registrati prima.',
                default => 'Login Apple mock non valido.',
            };

            if (! in_array($e->getMessage(), ['LOGIN_SOCIAL_USER_NOT_FOUND'], true)) {
                Utility::saveError($validated, $e->getMessage(), __METHOD__);
            }

            return response()->json([
                'ok' => false,
                'message' => $message,
            ], 422);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], 500);
        }
    }

    public function changeCurrentAccountToAppleMock(Request $request): JsonResponse
    {
        $validated = [];

        try {
            if (! app()->environment('local') || ! $this->isAppleMockEnabled()) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Apple mock auth non abilitato.',
                ], Response::HTTP_FORBIDDEN);
            }

            $userId = $this->resolveCurrentUserId($request);
            if ($userId <= 0) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Utente non autenticato.',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $validated = $request->validate([
                'mockEmail' => ['nullable', 'email', 'max:255'],
                'mockName' => ['nullable', 'string', 'max:255'],
                'mockSub' => ['nullable', 'string', 'max:255'],
            ]);

            $email = strtolower((string) ($validated['mockEmail'] ?? ''));
            $name = trim((string) ($validated['mockName'] ?? 'Apple Mock User'));
            $sub = trim((string) ($validated['mockSub'] ?? ''));

            if ($sub === '') {
                $sub = 'apple_mock_change_'.$userId.'_'.time();
            }

            $claims = [
                'iss' => 'https://appleid.apple.com',
                'aud' => (string) env('APPLE_CLIENT_ID', 'apple.mock.local'),
                'sub' => $sub,
                'email' => $email,
                'email_verified' => 'true',
                'is_private_email' => 'true',
                'mock' => true,
            ];

            $model = new UserAccount();
            $user = $model->switchCurrentUserToSocial(
                $userId,
                'apple',
                $sub,
                $email,
                true,
                $name,
                '',
                true,
                $claims
            );

            return $this->withPortalUserCookies(response()->json([
                'ok' => true,
                'data' => [
                    'user' => $user,
                    'mock' => true,
                ],
                'message' => 'Account Apple aggiornato con successo.',
            ], Response::HTTP_OK), $user);
        } catch (RuntimeException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
                'message' => 'Cambio account Apple mock non completato.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (QueryException $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } catch (Exception $e) {
            Utility::saveError($validated, $e->getMessage(), __METHOD__);

            return response()->json([
                'ok' => false,
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    private function normalizeRole(string $role): string
    {
        $normalized = strtolower(trim($role));
        $allowed = ['pet_owner', 'pet_assistant'];

        if (! in_array($normalized, $allowed, true)) {
            throw new RuntimeException('INVALID_ROLE');
        }

        return $normalized;
    }

    private function verifyGoogleIdToken(string $idToken): array
    {
        $response = Http::acceptJson()->get('https://oauth2.googleapis.com/tokeninfo', [
            'id_token' => $idToken,
        ]);

        if (! $response->ok()) {
            throw new RuntimeException('GOOGLE_TOKENINFO_ERROR');
        }

        $claims = $response->json();
        if (! is_array($claims)) {
            throw new RuntimeException('GOOGLE_INVALID_CLAIMS');
        }

        $issuer = (string) ($claims['iss'] ?? '');
        $aud = (string) ($claims['aud'] ?? '');
        $sub = (string) ($claims['sub'] ?? '');
        $email = strtolower((string) ($claims['email'] ?? ''));
        $emailVerifiedRaw = (string) ($claims['email_verified'] ?? '');
        $name = (string) ($claims['name'] ?? '');
        $avatar = (string) ($claims['picture'] ?? '');
        $configuredClientId = (string) env('GOOGLE_CLIENT_ID', '');

        if ($sub === '') {
            throw new RuntimeException('GOOGLE_SUB_MISSING');
        }

        if ($configuredClientId !== '' && $aud !== $configuredClientId) {
            throw new RuntimeException('GOOGLE_AUD_MISMATCH');
        }

        if (! in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)) {
            throw new RuntimeException('GOOGLE_ISS_MISMATCH');
        }

        $emailVerified = in_array(strtolower($emailVerifiedRaw), ['true', '1'], true);

        return [
            'sub' => $sub,
            'email' => $email,
            'emailVerified' => $emailVerified,
            'name' => $name,
            'avatar' => $avatar,
            'rawClaims' => $claims,
        ];
    }

    private function sendRegistrationEmailConfirmation(string $email, string $role): void
    {
        $expires = time() + 60 * 60 * 24;
        $signature = hash_hmac('sha256', $email.'|'.$role.'|'.$expires, (string) config('app.key'));
        $baseUrl = rtrim((string) config('app.url', 'http://localhost'), '/');
        $confirmUrl = $baseUrl.'/api/auth/verify-email?email='.urlencode($email).'&role='.urlencode($role).'&expires='.$expires.'&signature='.$signature;
        $roleLabel = $role === 'pet_assistant' ? 'Pet Assistant' : 'Pet Owner';

        $html = '<div style="margin:0;padding:28px 16px;background:#f3f5f6;font-family:Arial,sans-serif;color:#333333;">'
            .'<div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #d7e2ea;box-shadow:0 18px 40px rgba(17,42,77,0.12);">'
            .'<div style="padding:24px 28px;background:linear-gradient(120deg,#2F7A4A 0%,#1F5FA7 100%);">'
            .'<div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.82);font-weight:700;">Coccole Bestiali</div>'
            .'<div style="margin-top:8px;font-size:28px;line-height:1.15;color:#ffffff;font-weight:800;">Conferma il tuo indirizzo email</div>'
            .'<div style="margin-top:10px;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.88);">Stiamo preparando il tuo profilo '.$roleLabel.'. Ci manca solo la conferma del tuo indirizzo email.</div>'
            .'</div>'
            .'<div style="padding:30px 28px 26px 28px;">'
            .'<div style="margin-bottom:18px;padding:16px 18px;border-radius:16px;background:linear-gradient(180deg,rgba(47,122,74,0.08) 0%,rgba(31,95,167,0.08) 100%);border:1px solid rgba(31,95,167,0.12);">'
            .'<div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#1F5FA7;font-weight:800;">Indirizzo registrato</div>'
            .'<div style="margin-top:6px;font-size:18px;color:#17324d;font-weight:700;">'.e($email).'</div>'
            .'</div>'
            .'<p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#425466;">Premi il pulsante qui sotto per confermare l\'email e accedere direttamente alla pagina di completamento del profilo.</p>'
            .'<div style="margin:0 0 24px 0;">'
            .'<a href="'.$confirmUrl.'" style="display:inline-block;padding:14px 24px;border-radius:999px;background:linear-gradient(120deg,#2F7A4A 0%,#1F5FA7 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;">Conferma email e completa il profilo</a>'
            .'</div>'
            .'<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">Il link resta valido per 24 ore. Se non hai richiesto questa registrazione, puoi ignorare tranquillamente questa email.</p>'
            .'<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">Coccole Bestiali · Il tuo pet assistant di fiducia</p>'
            .'</div>'
            .'</div>'
            .'</div>';

        Mail::html($html, function ($message) use ($email) {
            $message
                ->from('info@coccolebestiali.it', 'Coccole Bestiali')
                ->to($email)
                ->subject('Coccole Bestiali - Conferma indirizzo email');
        });
    }

    private function generateTemporaryPassword(): string
    {
        $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $symbols = '!@#$%&*?';
        $password = [
            $alphabet[random_int(0, 23)],
            $alphabet[random_int(24, strlen($alphabet) - 1)],
            (string) random_int(2, 9),
            $symbols[random_int(0, strlen($symbols) - 1)],
        ];

        while (count($password) < 12) {
            $password[] = $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        shuffle($password);

        return implode('', $password);
    }

    private function sendTemporaryPasswordEmail(string $email, string $temporaryPassword): void
    {
        $html = '<div style="margin:0;padding:28px 16px;background:#f3f5f6;font-family:Arial,sans-serif;color:#333333;">'
            .'<div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #d7e2ea;box-shadow:0 18px 40px rgba(17,42,77,0.12);">'
            .'<div style="padding:24px 28px;background:linear-gradient(120deg,#2F7A4A 0%,#1F5FA7 100%);">'
            .'<div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.82);font-weight:700;">Coccole Bestiali</div>'
            .'<div style="margin-top:8px;font-size:28px;line-height:1.15;color:#ffffff;font-weight:800;">La tua password temporanea</div>'
            .'<div style="margin-top:10px;font-size:15px;line-height:1.55;color:rgba(255,255,255,0.88);">Usala per accedere e imposta subito una nuova password personale.</div>'
            .'</div>'
            .'<div style="padding:30px 28px 26px 28px;">'
            .'<p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#425466;">Abbiamo generato una password temporanea per il tuo account Coccole Bestiali.</p>'
            .'<div style="margin:0 0 20px 0;padding:18px 20px;border-radius:18px;background:linear-gradient(180deg,rgba(47,122,74,0.08) 0%,rgba(31,95,167,0.08) 100%);border:1px solid rgba(31,95,167,0.14);">'
            .'<div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#1F5FA7;font-weight:800;">Password temporanea</div>'
            .'<div style="margin-top:8px;font-size:26px;color:#17324d;font-weight:800;letter-spacing:0.08em;">'.e($temporaryPassword).'</div>'
            .'</div>'
            .'<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#64748b;">Dopo il login ti verra chiesto di scegliere una nuova password. Se non hai richiesto tu questa operazione, contattaci.</p>'
            .'<p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">Coccole Bestiali · Il tuo pet assistant di fiducia</p>'
            .'</div>'
            .'</div>'
            .'</div>';

        Mail::html($html, function ($message) use ($email) {
            $message
                ->from('info@coccolebestiali.it', 'Coccole Bestiali')
                ->to($email)
                ->subject('Coccole Bestiali - Password temporanea');
        });
    }

    private function emailVerificationHtml(bool $isSuccess): string
    {
        $title = $isSuccess ? 'Email confermata' : 'Conferma non valida';
        $message = $isSuccess
            ? 'Conferma completata con successo. Ora puoi proseguire nel portale.'
            : 'Il link di conferma non è valido o è scaduto.';
        $color = $isSuccess ? '#2F7A4A' : '#b91c1c';

        return '<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'
            .$title
            .'</title></head><body style="margin:0;font-family:Arial,sans-serif;background:#f3f5f6;color:#333;"><main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">'
            .'<section style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">'
            .'<header style="padding:16px 20px;background:'.$color.';color:#fff;font-weight:700;">Coccole Bestiali</header>'
            .'<div style="padding:22px;"><h1 style="margin:0 0 10px 0;font-size:24px;color:'.$color.';">'.$title.'</h1><p style="margin:0;line-height:1.5;">'.$message.'</p></div>'
            .'</section></main></body></html>';
    }

    private function verifyGoogleAccessToken(string $accessToken): array
    {
        $tokenInfoResponse = Http::acceptJson()->get('https://oauth2.googleapis.com/tokeninfo', [
            'access_token' => $accessToken,
        ]);
        if (! $tokenInfoResponse->ok()) {
            throw new RuntimeException('GOOGLE_TOKENINFO_ERROR');
        }
        $tokenInfo = $tokenInfoResponse->json();
        if (! is_array($tokenInfo)) {
            throw new RuntimeException('GOOGLE_INVALID_TOKENINFO');
        }

        $userInfoResponse = Http::acceptJson()
            ->withToken($accessToken)
            ->get('https://www.googleapis.com/oauth2/v3/userinfo');
        if (! $userInfoResponse->ok()) {
            throw new RuntimeException('GOOGLE_USERINFO_ERROR');
        }
        $userInfo = $userInfoResponse->json();
        if (! is_array($userInfo)) {
            throw new RuntimeException('GOOGLE_INVALID_USERINFO');
        }

        $configuredClientId = (string) env('GOOGLE_CLIENT_ID', '');
        $aud = (string) ($tokenInfo['aud'] ?? '');
        $azp = (string) ($tokenInfo['azp'] ?? '');
        if ($configuredClientId !== '' && ! in_array($configuredClientId, [$aud, $azp], true)) {
            throw new RuntimeException('GOOGLE_AUD_MISMATCH');
        }

        $sub = (string) ($userInfo['sub'] ?? ($tokenInfo['sub'] ?? ''));
        if ($sub === '') {
            throw new RuntimeException('GOOGLE_SUB_MISSING');
        }

        $email = strtolower((string) ($userInfo['email'] ?? ($tokenInfo['email'] ?? '')));
        $emailVerifiedRaw = (string) ($userInfo['email_verified'] ?? ($tokenInfo['email_verified'] ?? ''));
        $emailVerified = in_array(strtolower($emailVerifiedRaw), ['true', '1'], true);

        return [
            'sub' => $sub,
            'email' => $email,
            'emailVerified' => $emailVerified,
            'name' => (string) ($userInfo['name'] ?? ''),
            'avatar' => (string) ($userInfo['picture'] ?? ''),
            'rawClaims' => [
                'tokeninfo' => $tokenInfo,
                'userinfo' => $userInfo,
            ],
        ];
    }

    private function verifyAppleIdentityToken(string $identityToken, mixed $appleUserRaw): array
    {
        $claims = $this->decodeJwtPayload($identityToken);
        $issuer = (string) ($claims['iss'] ?? '');
        $aud = $claims['aud'] ?? '';
        $sub = (string) ($claims['sub'] ?? '');
        $email = strtolower((string) ($claims['email'] ?? ''));
        $emailVerifiedRaw = (string) ($claims['email_verified'] ?? '');
        $isPrivateRaw = (string) ($claims['is_private_email'] ?? '');
        $configuredClientId = (string) env('APPLE_CLIENT_ID', '');

        if ($sub === '') {
            throw new RuntimeException('APPLE_SUB_MISSING');
        }

        if ($issuer !== 'https://appleid.apple.com') {
            throw new RuntimeException('APPLE_ISS_MISMATCH');
        }

        if ($configuredClientId !== '') {
            $audOk = false;
            if (is_string($aud) && $aud === $configuredClientId) {
                $audOk = true;
            }
            if (is_array($aud) && in_array($configuredClientId, $aud, true)) {
                $audOk = true;
            }
            if (! $audOk) {
                throw new RuntimeException('APPLE_AUD_MISMATCH');
            }
        }

        $appleUser = $this->normalizeAppleUser($appleUserRaw);
        if ($email === '' && isset($appleUser['email'])) {
            $email = strtolower((string) $appleUser['email']);
        }

        $name = '';
        if (isset($appleUser['name']) && is_array($appleUser['name'])) {
            $firstName = trim((string) ($appleUser['name']['firstName'] ?? ''));
            $lastName = trim((string) ($appleUser['name']['lastName'] ?? ''));
            $name = trim($firstName.' '.$lastName);
        }

        $emailVerified = in_array(strtolower($emailVerifiedRaw), ['true', '1'], true);
        $isPrivateEmail = in_array(strtolower($isPrivateRaw), ['true', '1'], true);

        return [
            'sub' => $sub,
            'email' => $email,
            'emailVerified' => $emailVerified,
            'name' => $name,
            'isPrivateEmail' => $isPrivateEmail,
            'rawClaims' => $claims,
        ];
    }

    private function decodeJwtPayload(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new RuntimeException('JWT_FORMAT_INVALID');
        }

        $payload = $parts[1];
        $payload .= str_repeat('=', (4 - strlen($payload) % 4) % 4);
        $payload = str_replace(['-', '_'], ['+', '/'], $payload);

        $decoded = base64_decode($payload, true);
        if ($decoded === false) {
            throw new RuntimeException('JWT_PAYLOAD_DECODE_ERROR');
        }

        $claims = json_decode($decoded, true);
        if (! is_array($claims)) {
            throw new RuntimeException('JWT_PAYLOAD_JSON_ERROR');
        }

        return $claims;
    }

    private function normalizeAppleUser(mixed $appleUserRaw): array
    {
        if (is_array($appleUserRaw)) {
            return $appleUserRaw;
        }

        if (is_string($appleUserRaw) && trim($appleUserRaw) !== '') {
            $decoded = json_decode($appleUserRaw, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return [];
    }

    private function isAppleMockEnabled(): bool
    {
        return in_array(strtolower((string) env('APPLE_MOCK_AUTH', 'false')), ['1', 'true', 'yes', 'on'], true);
    }

    private function profileRedirectPathForRole(string $role): string
    {
        return $role === 'pet_owner' ? '/profile/petowner' : '/profile/petassistant';
    }

    private function profileRedirectPathForRoleAndEntry(string $role, string $entry): string
    {
        $basePath = $this->profileRedirectPathForRole($role);
        return $basePath.'?entry='.urlencode($entry);
    }

    private function withPortalUserCookies($response, array $user)
    {
        $userId = (string) ((int) ($user['id'] ?? 0));
        $role = (string) ($user['role'] ?? '');
        $minutes = 60 * 24 * 30;

        $this->startPortalSession((int) $userId, $role);

        return $response
            ->cookie(self::PORTAL_USER_ID_COOKIE, $userId, $minutes, '/', null, false, false, false, 'Lax')
            ->cookie(self::PORTAL_USER_ROLE_COOKIE, $role, $minutes, '/', null, false, false, false, 'Lax');
    }

    private function resolveCurrentUserId(Request $request): int
    {
        if ($request->hasSession()) {
            $sessionUserId = (int) $request->session()->get(self::PORTAL_USER_ID_COOKIE, 0);
            if ($sessionUserId > 0) {
                return $sessionUserId;
            }
        }

        $requestCookie = (int) $request->cookie(self::PORTAL_USER_ID_COOKIE, 0);
        if ($requestCookie > 0) {
            return $requestCookie;
        }

        $globalCookie = (int) ($_COOKIE[self::PORTAL_USER_ID_COOKIE] ?? 0);
        if ($globalCookie > 0) {
            return $globalCookie;
        }

        $rawCookieHeader = (string) $request->headers->get('cookie', '');
        if ($rawCookieHeader !== '') {
            preg_match('/(?:^|;\s*)'.preg_quote(self::PORTAL_USER_ID_COOKIE, '/').'=(\d+)/', $rawCookieHeader, $matches);
            if (isset($matches[1])) {
                return (int) $matches[1];
            }
        }

        return 0;
    }

    private function startPortalSession(int $userId, string $role): void
    {
        if ($userId <= 0) {
            return;
        }

        $request = request();
        if (! $request->hasSession()) {
            return;
        }

        $request->session()->regenerate();
        $request->session()->put(self::PORTAL_USER_ID_COOKIE, $userId);
        $request->session()->put(self::PORTAL_USER_ROLE_COOKIE, $role);
    }
}
