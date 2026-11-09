<?php

namespace Tests\Feature;

use App\Models\UserAccount;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class SocialAccountSecurityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropAllTables();
        Schema::create('users', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('role');
            $table->string('name')->default('');
            $table->string('email')->nullable()->unique();
            $table->boolean('email_verified')->default(false);
            $table->string('password_hash')->default('');
            $table->boolean('password_reset_required')->default(false);
            $table->string('avatar')->default('');
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
        });
        Schema::create('social_accounts', function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->string('provider');
            $table->string('provider_sub');
            $table->string('provider_email')->default('');
            $table->boolean('provider_email_verified')->default(false);
            $table->boolean('is_private_email')->default(false);
            $table->text('raw_claims')->nullable();
            $table->integer('created_at')->default(0);
            $table->integer('updated_at')->default(0);
            $table->unique(['provider', 'provider_sub']);
        });
        DB::table('users')->insert([
            'id' => 1,
            'role' => 'pet_owner',
            'name' => 'Victim',
            'email' => 'victim@example.test',
            'email_verified' => true,
        ]);
    }

    public function test_social_login_never_falls_back_to_an_unlinked_email(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('LOGIN_SOCIAL_USER_NOT_FOUND');

        (new UserAccount)->loginSocialUser('apple', 'attacker-provider-sub', 'victim@example.test');
    }

    public function test_social_login_requires_the_exact_provider_and_subject_pair(): void
    {
        DB::table('social_accounts')->insert([
            'user_id' => 1,
            'provider' => 'google',
            'provider_sub' => 'trusted-google-sub',
            'provider_email' => 'victim@example.test',
            'provider_email_verified' => true,
        ]);

        $this->assertSame(1, (new UserAccount)->loginSocialUser('google', 'trusted-google-sub')['id']);

        $this->expectException(RuntimeException::class);
        (new UserAccount)->loginSocialUser('apple', 'trusted-google-sub');
    }

    public function test_verified_provider_email_can_link_a_legacy_account_once(): void
    {
        $user = (new UserAccount)->loginSocialUser(
            'google',
            'verified-google-sub',
            'victim@example.test',
            true,
            false,
            ['sub' => 'verified-google-sub', 'email_verified' => true]
        );

        $this->assertSame(1, $user['id']);
        $this->assertDatabaseHas('social_accounts', [
            'user_id' => 1,
            'provider' => 'google',
            'provider_sub' => 'verified-google-sub',
            'provider_email_verified' => 1,
        ]);
    }

    public function test_unverified_provider_email_never_links_a_legacy_account(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('LOGIN_SOCIAL_USER_NOT_FOUND');

        (new UserAccount)->loginSocialUser(
            'google',
            'unverified-google-sub',
            'victim@example.test',
            false
        );
    }
}
