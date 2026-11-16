<?php

namespace Tests\Feature;

use App\Http\Controllers\AuthController;
use App\Support\PortalSession;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use ReflectionMethod;
use RuntimeException;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200)
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    public function test_state_changing_web_requests_require_a_csrf_token(): void
    {
        $this->app->detectEnvironment(static fn (): string => 'local');

        $this->postJson('/api/messages', [])->assertStatus(419);
    }

    public function test_email_header_injection_is_rejected_before_the_controller(): void
    {
        $this->postJson('/api/auth/login/email', [
            'email' => "victim@example.test\r\nBcc: attacker@example.test",
            'password' => 'irrelevant',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Indirizzo email non valido.');
    }

    public function test_portal_login_rotates_the_session_identifier(): void
    {
        $session = new Store('security-test', new ArraySessionHandler(120));
        $session->setId(str_repeat('a', 40));
        $session->start();
        $request = Request::create('/api/auth/login/email', 'POST');
        $request->setLaravelSession($session);

        PortalSession::start($request, 42);

        $this->assertNotSame(str_repeat('a', 40), $session->getId());
        $this->assertSame(42, $session->get(PortalSession::USER_ID_KEY));
    }

    public function test_admin_login_is_rate_limited(): void
    {
        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $response = $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.44'])
                ->postJson('/api/admin/auth/login', ['username' => 'invalid', 'password' => 'invalid']);
            $this->assertContains($response->status(), [401, 503]);
        }

        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.44'])
            ->postJson('/api/admin/auth/login', ['username' => 'invalid', 'password' => 'invalid'])
            ->assertTooManyRequests();
    }

    public function test_sensitive_route_families_have_central_guards(): void
    {
        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();
            $middleware = $route->gatherMiddleware();

            if (str_starts_with($uri, 'api/profile/petowner/') || str_starts_with($uri, 'api/profile/petassistant/')) {
                $this->assertContains('portal.auth', $middleware, $uri);
            }

            if (str_starts_with($uri, 'api/admin/') && ! in_array($uri, ['api/admin/auth/login', 'api/admin/auth/session'], true)) {
                $this->assertContains('portal.admin', $middleware, $uri);
            }

            if (str_starts_with($uri, 'api/bookings') && ! str_starts_with($uri, 'api/bookings/action/')) {
                $this->assertContains('portal.auth', $middleware, $uri);
            }

            if (($uri === 'api/bookings' && in_array('POST', $route->methods(), true)) || $uri === 'api/bookings/batch') {
                $this->assertContains('portal.capability:owner', $middleware, $uri);
            }

            if (in_array($uri, ['api/bookings/active-for-assistant', 'api/bookings/confirmation-mode'], true)) {
                $this->assertContains('portal.capability:assistant', $middleware, $uri);
            }

            if ($uri === 'api/pet-assistant-favorites' || str_ends_with($uri, '/favorite')) {
                $this->assertContains('portal.auth', $middleware, $uri);
                $this->assertContains('portal.capability:owner', $middleware, $uri);
            }
        }
    }

    public function test_head_requests_cannot_bypass_admin_authorization(): void
    {
        $this->call('HEAD', '/api/admin/messages')->assertUnauthorized();
    }

    public function test_apple_identity_token_requires_a_trusted_signature(): void
    {
        [$trustedPrivateKey, $trustedJwk] = $this->rsaKeyPair('trusted-key');
        [$attackerPrivateKey] = $this->rsaKeyPair('attacker-key');
        Http::fake(['https://appleid.apple.com/auth/keys' => Http::response(['keys' => [$trustedJwk]])]);
        Cache::forget('auth.apple.signing-keys');
        $this->setAppleClientId('it.coccolebestiali.test');

        $claims = [
            'iss' => 'https://appleid.apple.com',
            'aud' => 'it.coccolebestiali.test',
            'sub' => 'apple-user-1',
            'email' => 'apple@example.test',
            'email_verified' => 'true',
            'nonce' => 'expected-nonce',
            'iat' => time(),
            'exp' => time() + 300,
        ];
        $forgedToken = JWT::encode($claims, $attackerPrivateKey, 'RS256', 'attacker-key');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('APPLE_TOKEN_SIGNATURE_INVALID');
        $this->verifyAppleToken($forgedToken, 'expected-nonce');
    }

    public function test_apple_identity_token_accepts_a_valid_apple_signature(): void
    {
        [$trustedPrivateKey, $trustedJwk] = $this->rsaKeyPair('trusted-key');
        Http::fake(['https://appleid.apple.com/auth/keys' => Http::response(['keys' => [$trustedJwk]])]);
        Cache::forget('auth.apple.signing-keys');
        $this->setAppleClientId('it.coccolebestiali.test');
        $token = JWT::encode([
            'iss' => 'https://appleid.apple.com',
            'aud' => 'it.coccolebestiali.test',
            'sub' => 'apple-user-2',
            'email' => 'valid@example.test',
            'email_verified' => 'true',
            'nonce' => 'expected-nonce',
            'iat' => time(),
            'exp' => time() + 300,
        ], $trustedPrivateKey, 'RS256', 'trusted-key');

        $claims = $this->verifyAppleToken($token, 'expected-nonce');

        $this->assertSame('apple-user-2', $claims['sub']);
        $this->assertSame('valid@example.test', $claims['email']);
    }

    public function test_apple_identity_token_rejects_a_nonce_mismatch(): void
    {
        [$trustedPrivateKey, $trustedJwk] = $this->rsaKeyPair('trusted-key');
        Http::fake(['https://appleid.apple.com/auth/keys' => Http::response(['keys' => [$trustedJwk]])]);
        Cache::forget('auth.apple.signing-keys');
        $this->setAppleClientId('it.coccolebestiali.test');
        $token = JWT::encode([
            'iss' => 'https://appleid.apple.com',
            'aud' => 'it.coccolebestiali.test',
            'sub' => 'apple-user-3',
            'nonce' => 'nonce-from-another-browser-session',
            'iat' => time(),
            'exp' => time() + 300,
        ], $trustedPrivateKey, 'RS256', 'trusted-key');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('APPLE_NONCE_MISMATCH');
        $this->verifyAppleToken($token, 'expected-nonce');
    }

    private function verifyAppleToken(string $token, string $expectedNonce): array
    {
        $method = new ReflectionMethod(AuthController::class, 'verifyAppleIdentityToken');

        return $method->invoke(new AuthController, $token, null, $expectedNonce);
    }

    private function setAppleClientId(string $clientId): void
    {
        putenv('APPLE_CLIENT_ID='.$clientId);
        $_ENV['APPLE_CLIENT_ID'] = $clientId;
        $_SERVER['APPLE_CLIENT_ID'] = $clientId;
    }

    private function rsaKeyPair(string $kid): array
    {
        $resource = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $this->assertNotFalse($resource);
        $this->assertTrue(openssl_pkey_export($resource, $privateKey));
        $details = openssl_pkey_get_details($resource);
        $this->assertIsArray($details);

        $encode = static fn (string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');

        return [$privateKey, [
            'kty' => 'RSA',
            'kid' => $kid,
            'use' => 'sig',
            'alg' => 'RS256',
            'n' => $encode($details['rsa']['n']),
            'e' => $encode($details['rsa']['e']),
        ]];
    }
}
