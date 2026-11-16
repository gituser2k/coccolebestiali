# STEP 1 — Security review e hardening

Data: 2026-11-09

Branch: `changeaccount`

Perimetro: applicazione locale, autenticazione, sessioni, OAuth, API, CMS, dipendenze e configurazione HTTP. Nessun test è stato eseguito verso sistemi terzi o ambienti di produzione.

Stato milestone: **approvata manualmente — OK STEP 1 ricevuto il 2026-11-09**.

## Esito sintetico

La revisione ha individuato e corretto due vulnerabilità di possibile account takeover:

1. il token Apple veniva decodificato senza verificarne la firma;
2. il login social poteva ripiegare sulla sola email quando non esisteva la coppia esatta provider/subject.

Sono stati inoltre aggiunti rate limiting, rotazione sessione verificata, header HTTP difensivi, configurazione CMS fail-closed, protezione contro bypass `HEAD`, rimozione di un sink XSS non necessario e aggiornamenti delle dipendenze Symfony vulnerabili.

## Controlli eseguiti

| Area | Controllo | Esito |
| --- | --- | --- |
| Identità | cookie ID/ruolo forgiati | rifiutati con `401` |
| Sessione | rotazione ID dopo autenticazione | verificata automaticamente |
| Sessione | cookie Laravel | `HttpOnly`, `SameSite=Lax`; `Secure` obbligatorio in HTTPS |
| CSRF | mutazione senza token | `419` |
| CSRF | token valido | richiesta ammessa al controller |
| Autorizzazione | famiglie profilo/prenotazioni/CMS | guardie centrali censite da test |
| HTTP method | richiesta `HEAD` a risorsa CMS | `401`, nessun bypass |
| Apple OAuth | JWT con firma non attendibile | rifiutato |
| Apple OAuth | JWT con firma RSA attendibile | accettato |
| Apple OAuth | nonce appartenente a un'altra sessione | rifiutato |
| Social login | provider/subject inesistente ma email vittima esistente | rifiutato |
| Brute force | login CMS oltre soglia | `429` |
| CMS | credenziali ambiente mancanti | fail-closed `503`, nessun default noto |
| XSS | assegnazione HTML nel modal utility | sostituita con `textContent` |
| Email injection | CR/LF e caratteri di controllo nei campi email | rifiutati prima dei controller |
| Header | nosniff, anti-frame, referrer, permissions | presenti su risposta reale MAMP |
| Dipendenze frontend runtime | `npm audit --omit=dev` | 0 vulnerabilità |
| Dipendenze PHP | Laravel 11.57.1 e `composer audit` | advisory critico TokenGuard rimosso; restano cinque advisory che richiedono Laravel 12, vedi sotto |

## Correzioni implementate

- verifica Apple tramite JWKS ufficiale, algoritmo RSA, `state` monouso e `nonce` legato alla sessione; validazione delle claim eseguita da `firebase/php-jwt`;
- cache delle chiavi Apple per sei ore con refresh in caso di rotazione;
- login Google/Apple consentito soltanto per la coppia esatta `provider + provider_sub` già associata;
- compatibilità sicura per account social legacy: al primo login il collegamento viene creato soltanto quando il provider certifica l'email come verificata; email non verificata o fornita dal client non è sufficiente;
- associazione per email in registrazione social consentita soltanto se l'email è verificata dal provider;
- email fornita dal payload Apple client non usata come identità attendibile;
- link di conferma email non crea più automaticamente una sessione: conferma e rimanda al login;
- limiti per IP su login email/social/CMS, registrazione, password dimenticata, contatti, error reporting e ricerca;
- login CMS senza variabili ambiente rifiutato;
- messaggi email/password errati uniformati per ridurre l'enumerazione account;
- middleware globale contro header injection nei valori email;
- `SecurityHeaders` globale e `Cache-Control: no-store` per auth/CMS;
- `.env.example` con debug disattivato e credenziali CMS vuote.

## Dipendenze

- aggiunto `firebase/php-jwt` 7.x;
- aggiornati i componenti Symfony interessati agli ultimi patch compatibili (`http-foundation`, `http-kernel`, `mime`, `routing` e dipendenze correlate);
- audit npm completo: nessuna vulnerabilità, dopo aggiornamento compatibile della toolchain `typescript-eslint/minimatch` nello STEP 8;
- Laravel aggiornato da 11.51.0 a 11.57.1 nello STEP 8, restando nella stessa major: l'advisory critico TokenGuard non è più presente;
- Composer simula la piattaforma PHP 8.3.30, uguale al runtime MAMP, per impedire l'installazione accidentale di pacchetti che richiedono PHP 8.4+;
- rimangono cinque advisory su Laravel 11, eliminabili soltanto con Laravel 12.71 o successivo. L'header injection email è già bloccata dal middleware globale e dai test; la verifica email usa una firma HMAC applicativa e non URL Laravel temporaneamente firmati. Le altre segnalazioni restano comunque censite fino al cambio major.

## Rischi residui da non nascondere

1. **Reset password**: il flusso attuale sostituisce subito la password con una temporanea inviata via email. Il rate limiting riduce l'abuso, ma resta possibile provocare lockout ripetuti conoscendo l'email. Va sostituito con token monouso hashato e scadenza, senza modificare la password fino alla conferma.
2. **Laravel 11**: il patch-level è 11.57.1 e la criticità TokenGuard è stata rimossa, ma cinque advisory restano formalmente aperti. Serve una milestone tecnica di upgrade almeno a Laravel 12.71; non è stato eseguito un cambio major non concordato.
3. **CSP**: non è stata imposta una Content Security Policy rigida perché il CMS contiene script/style inline e dipendenze CDN. Prima occorre estrarre gli inline o introdurre nonce/hash.
4. **2FA e session management**: il portale non offre MFA, elenco sessioni, revoca remota o notifica di nuovo accesso.
5. **Rate limiting distribuito**: in produzione il limiter deve usare uno store condiviso e la configurazione proxy deve garantire un IP client affidabile.
6. **Audit esterno**: questi test aumentano sensibilmente la sicurezza ma non equivalgono a un penetration test indipendente su infrastruttura, web server, TLS, DNS, email e hosting reali.

## Requisiti di deploy

- `APP_DEBUG=false`;
- `APP_ENV=production`;
- `APP_KEY` univoca e segreta;
- `SESSION_SECURE_COOKIE=true` sotto HTTPS;
- credenziali CMS lunghe, casuali e valorizzate esclusivamente nell'ambiente;
- HTTPS obbligatorio e HSTS verificato;
- cache/rate limiter condiviso se esistono più istanze;
- nessun file `.env`, backup o storage privato servito dalla document root;
- eseguire `composer audit` e `npm audit --omit=dev` in CI a ogni rilascio.

## Comandi di verifica

```bash
cd php && php artisan test
cd php && composer audit --locked
cd html && npm run lint
cd html && npm run build
cd html && npm audit --omit=dev
```

## Riferimenti primari

- Apple, verifica dell'identità: <https://developer.apple.com/documentation/signinwithapple/verifying-a-user>
- Apple, JWKS pubblico: <https://developer.apple.com/documentation/signinwithapplerestapi/fetch-apple%27s-public-key-for-verifying-token-signature>
- Laravel TokenGuard advisory: <https://github.com/laravel/framework/security/advisories/GHSA-f9x3-7vq9-cph6>
