#!/usr/bin/env bash

set -euo pipefail

ROOT="${1:-/Applications/MAMP/htdocs/coccolebestiali}"
DEPLOY_ROOT="${2:-/tmp/coccolebestiali-netsons-deploy}"
ARCHIVE_PATH="${3:-/tmp/coccolebestiali-netsons.zip}"
DB_PASSWORD_FILE="${DB_PASSWORD_FILE:-/tmp/cb_netsons_db_password}"
CMS_PASSWORD_FILE="${CMS_PASSWORD_FILE:-/tmp/cb_netsons_admin_password}"
CPANEL_HOME="${CPANEL_HOME:-/home/ouhklbwt}"
DB_NAME="${DB_NAME:-ouhklbwt_coccolebestiali}"
DB_USER="${DB_USER:-ouhklbwt_cbapp}"
APP_DOMAIN="${APP_DOMAIN:-petsitedemo.netsons.org}"

if [[ -e "$DEPLOY_ROOT" || -e "$ARCHIVE_PATH" ]]; then
  echo "La destinazione di deploy esiste gia. Rimuovila prima di rigenerare il pacchetto." >&2
  exit 1
fi

if [[ ! -f "$DB_PASSWORD_FILE" ]]; then
  echo "Password database Netsons non disponibile." >&2
  exit 1
fi

mkdir -p \
  "$DEPLOY_ROOT/coccolebestiali_app/php" \
  "$DEPLOY_ROOT/coccolebestiali_app/html/src/html" \
  "$DEPLOY_ROOT/public_html"

(
  cd "$ROOT/html"
  npm run build
)

rsync -a \
  --exclude='.DS_Store' \
  --exclude='.env' \
  --exclude='.phpunit.result.cache' \
  --exclude='.vscode' \
  --exclude='tests' \
  --exclude='migration' \
  --exclude='public/assets' \
  --exclude='public/storage' \
  --exclude='storage/app/backups/***' \
  --exclude='storage/framework/cache/data/***' \
  --exclude='storage/framework/sessions/***' \
  --exclude='storage/framework/views/***' \
  --exclude='storage/logs/***' \
  "$ROOT/php/app" \
  "$ROOT/php/bootstrap" \
  "$ROOT/php/config" \
  "$ROOT/php/database" \
  "$ROOT/php/resources" \
  "$ROOT/php/routes" \
  "$ROOT/php/storage" \
  "$ROOT/php/artisan" \
  "$ROOT/php/composer.json" \
  "$ROOT/php/composer.lock" \
  "$DEPLOY_ROOT/coccolebestiali_app/php/"

mkdir -p "$DEPLOY_ROOT/coccolebestiali_app/php/migration"
cp "$ROOT/php/migration/seed_current_profiles.sql" "$DEPLOY_ROOT/coccolebestiali_app/php/migration/"

rsync -a --exclude='.DS_Store' "$ROOT/html/dist" "$DEPLOY_ROOT/coccolebestiali_app/html/"
cp "$ROOT/html/src/html/cmsadminsite.html" "$DEPLOY_ROOT/coccolebestiali_app/html/src/html/"
cp "$ROOT/html/src/utility.js" "$DEPLOY_ROOT/coccolebestiali_app/html/src/"

(
  cd "$DEPLOY_ROOT/coccolebestiali_app/php"
  composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-progress --ignore-platform-req=php
)

APP_KEY_VALUE="$(cd "$ROOT/php" && php artisan key:generate --show)"
DB_PASSWORD_VALUE="$(tr -d '\n' < "$DB_PASSWORD_FILE")"

if [[ -s "$CMS_PASSWORD_FILE" ]]; then
  CMS_PASSWORD_VALUE="$(tr -d '\n' < "$CMS_PASSWORD_FILE")"
else
  CMS_PASSWORD_VALUE="CbAdmin!$(openssl rand -hex 12)"
  printf '%s' "$CMS_PASSWORD_VALUE" > "$CMS_PASSWORD_FILE"
  chmod 600 "$CMS_PASSWORD_FILE"
fi

cat > "$DEPLOY_ROOT/coccolebestiali_app/php/.env" <<EOF
APP_NAME="Coccole Bestiali"
APP_ENV=production
APP_KEY=$APP_KEY_VALUE
APP_DEBUG=false
APP_URL=https://$APP_DOMAIN
APP_TIMEZONE=Europe/Rome
APP_LOCALE=it
APP_FALLBACK_LOCALE=it
APP_FAKER_LOCALE=it_IT
APP_MAINTENANCE_DRIVER=file

CMS_ADMIN_USERNAME=coccoadmin
CMS_ADMIN_PASSWORD=$CMS_PASSWORD_VALUE

BCRYPT_ROUNDS=12
LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=$DB_NAME
DB_USERNAME=$DB_USER
DB_PASSWORD=$DB_PASSWORD_VALUE

SESSION_DRIVER=file
SESSION_LIFETIME=120
SESSION_ENCRYPT=true
SESSION_PATH=/
SESSION_DOMAIN=$APP_DOMAIN
SESSION_SECURE_COOKIE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
CACHE_STORE=file

MAIL_MAILER=sendmail
MAIL_SENDMAIL_PATH="/usr/sbin/sendmail -bs -i"
MAIL_FROM_ADDRESS="info@$APP_DOMAIN"
MAIL_FROM_NAME="Coccole Bestiali"

GOOGLE_CLIENT_ID=408014807362-gv881e8utiligcb242h0tba8nin1gu35.apps.googleusercontent.com
APPLE_CLIENT_ID=
APPLE_REDIRECT_URI=https://$APP_DOMAIN/register
APPLE_MOCK_AUTH=false
EOF
chmod 600 "$DEPLOY_ROOT/coccolebestiali_app/php/.env"

find "$DEPLOY_ROOT/coccolebestiali_app/php/storage" -type d -exec chmod 775 {} +
find "$DEPLOY_ROOT/coccolebestiali_app/php/storage" -type f -exec chmod 664 {} +
find "$DEPLOY_ROOT/coccolebestiali_app/php/bootstrap/cache" -type d -exec chmod 775 {} +
find "$DEPLOY_ROOT/coccolebestiali_app/php/bootstrap/cache" -type f -exec chmod 664 {} +

cat > "$DEPLOY_ROOT/public_html/index.php" <<PHP
<?php

use Illuminate\\Foundation\\Application;
use Illuminate\\Http\\Request;

define('LARAVEL_START', microtime(true));

\$appRoot = '$CPANEL_HOME/coccolebestiali_app/php';

if (file_exists(\$maintenance = \$appRoot.'/storage/framework/maintenance.php')) {
    require \$maintenance;
}

require \$appRoot.'/vendor/autoload.php';

/** @var Application \$app */
\$app = require_once \$appRoot.'/bootstrap/app.php';

\$app->handleRequest(Request::capture());
PHP

{
  printf '%s\n' \
    'DirectoryIndex index.php' \
    '' \
    '<IfModule mod_headers.c>' \
    '    <Files "index.php">' \
    '        Header always set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"' \
    '        Header always set Pragma "no-cache"' \
    '        Header always set Expires "0"' \
    '    </Files>' \
    '</IfModule>' \
    '' \
    '<IfModule mod_rewrite.c>' \
    '    RewriteEngine On' \
    '    RewriteCond %{HTTPS} !=on' \
    '    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301,NE]' \
    '</IfModule>' \
    ''
  sed -n '1,$p' "$ROOT/php/public/.htaccess"
} > "$DEPLOY_ROOT/public_html/.htaccess"
rsync -a "$ROOT/html/dist/assets/" "$DEPLOY_ROOT/public_html/assets/"
cp "$ROOT"/html/dist/assets/favicon-*.ico "$DEPLOY_ROOT/public_html/favicon.ico"

mkdir -p "$DEPLOY_ROOT/database"
php -r '
    $env = parse_ini_file($argv[1], false, INI_SCANNER_RAW);
    $config = "[client]\n";
    $config .= "host=".$env["DB_HOST"]."\n";
    $config .= "port=".$env["DB_PORT"]."\n";
    $config .= "user=".$env["DB_USERNAME"]."\n";
    $config .= "password=".($env["DB_PASSWORD"] ?? "")."\n";
    file_put_contents($argv[2], $config);
' "$ROOT/php/.env" "$DEPLOY_ROOT/database/client.cnf"
chmod 600 "$DEPLOY_ROOT/database/client.cnf"

/Applications/MAMP/Library/bin/mysql80/bin/mysqldump \
  --defaults-extra-file="$DEPLOY_ROOT/database/client.cnf" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --no-tablespaces \
  --set-gtid-purged=OFF \
  coccolebestiali > "$DEPLOY_ROOT/database/coccolebestiali-demo.sql"

rm "$DEPLOY_ROOT/database/client.cnf"

(
  cd "$DEPLOY_ROOT"
  zip -qry "$ARCHIVE_PATH" coccolebestiali_app public_html
)

shasum -a 256 "$ARCHIVE_PATH" > "$ARCHIVE_PATH.sha256"
ls -lh "$ARCHIVE_PATH" "$DEPLOY_ROOT/database/coccolebestiali-demo.sql"
cat "$ARCHIVE_PATH.sha256"
