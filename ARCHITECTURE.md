# Architettura e registro tecnico di Coccole Bestiali

> Documento vivente e fonte di orientamento tecnico del portale.
>
> Ultima ricognizione completa: **16 novembre 2026**.
> Stato descritto: codice presente nel workspace, incluse le modifiche locali non ancora consolidate.

## 1. Scopo e regole di manutenzione

Questo documento descrive l'architettura applicativa, i moduli, le API, il modello dati, i flussi, le dipendenze esterne, i vincoli e le decisioni progettuali di Coccole Bestiali. Deve consentire a chi interviene in futuro di capire l'impatto di una modifica prima di cambiare codice o database.

È obbligatorio aggiornare questo file nello stesso intervento quando cambia almeno uno dei seguenti elementi:

- struttura del database, indice, vincolo, seed o snapshot;
- route, payload, risposta o codice di stato di una API;
- autenticazione, autorizzazione, sessione o ruolo/capacità;
- flusso di registrazione, profilo, ricerca, prenotazione, recensione o CMS;
- struttura del frontend, entry point, pagina o componente condiviso;
- storage pubblico o privato e ciclo di vita dei file;
- integrazione esterna, variabile d'ambiente, job o comando operativo;
- regola di business, policy configurabile o stato di dominio;
- decisione architetturale e relativo piano di migrazione.

Ogni aggiornamento deve inoltre aggiungere una riga al **Registro delle modifiche architetturali** in fondo al documento. Non inserire segreti, password reali, token, dati personali o valori del file `.env`.

### Checklist obbligatoria per modifiche al database

1. Aggiornare `php/migration/migration.txt` con SQL idempotente e non distruttivo.
2. Aggiornare il catalogo dati e le relazioni in questo documento.
3. Aggiornare `php/migration/README.md` se cambiano procedure, storage o dataset.
4. Adeguare seed, export e snapshot demo interessati.
5. Aggiungere gli indici necessari alle query e i vincoli applicabili.
6. Definire backfill, compatibilità e rollback operativo.
7. Verificare CRUD, autorizzazioni, cancellazione account e pulizia file.
8. Aggiungere o aggiornare i test automatici.
9. Registrare la modifica nel changelog in fondo a questo file.

## 2. Sintesi del prodotto

Coccole Bestiali è un marketplace per servizi dedicati agli animali domestici. Ogni identità è un account globale che può possedere contemporaneamente due capability indipendenti:

- **Pet Owner**: registra uno o più pet, cerca Pet Assistant, salva preferiti, invia prenotazioni, gestisce richieste e recensioni.
- **Pet Assistant**: configura identità professionale, servizi, prezzi, caratteristiche, galleria, calendario e gestisce le richieste ricevute.

Un CMS amministrativo gestisce messaggi, errori, cataloghi, servizi, policy e dataset demo.

Il modello è stato consolidato nello STEP 10: registrazione neutra, dati contestuali, reputazione, onboarding e autorizzazioni non dipendono da un ruolo esclusivo.

## 3. Stack tecnologico

| Livello | Tecnologia | Versione/vincolo rilevato |
| --- | --- | --- |
| Backend | PHP | `^8.2` |
| Framework | Laravel | `^12.71` nel manifest; `12.72.0` nel lockfile |
| Database | MySQL/MariaDB | default MySQL, charset `utf8mb4` |
| Accesso dati | Laravel Query Builder | prevalente; non sono usati aggregate Eloquent completi |
| Frontend | React | `^19.2.4` |
| Linguaggio frontend | TypeScript | `~5.9.3` |
| Bundler/dev server | Vite | `^8.0.1` |
| CSS | CSS dedicato + Tailwind | Tailwind `^4.2.2`; CMS usa Tailwind 2 via CDN |
| Mappe | Leaflet | `^1.9.4` |
| Navigazione demo | Inertia | client `^3`, backend `^1.3` |
| Test backend | PHPUnit | `^11.0` |
| Test browser | Playwright | `^1.59.1`, usato anche dagli script screenshot |

Il README radice e il manifest sono allineati su Laravel 12. Composer simula PHP `8.3.30`, corrispondente al runtime MAMP collaudato, così il lockfile non può selezionare dipendenze che richiedono versioni PHP superiori.

## 4. Topologia e runtime

```text
Browser
  |
  | pagine HTML compilate e chiamate fetch /api/*
  v
Laravel (php/)
  |-- serve gli entry HTML prodotti da Vite
  |-- controller HTTP e validazione
  |-- modelli/servizi basati su Query Builder
  |-- sessione, cache, mail, scheduler, storage
  v
MySQL/MariaDB + storage/app/public + storage/app/private

Servizi esterni:
  Google Identity / OAuth
  Apple Sign In
  dataset comuni italiani (ANPR)
  Nominatim/OpenStreetMap
  provider email configurato da Laravel
```

Laravel carica `php/routes/api.php` come file di route `web` in `php/bootstrap/app.php`. Di conseguenza lo stesso file contiene sia pagine sia API e applica sessione e CSRF del gruppo `web`. Dallo STEP 1 tutte le API sono registrate una sola volta sotto `/api`: le mutazioni mantengono `VerifyCsrfToken`, le risorse utente usano `portal.auth` e quelle CMS usano `portal.admin`.

In sviluppo Vite inoltra `/api` a `http://127.0.0.1:8000`. In produzione Laravel serve i file generati in `html/dist/src/html/`.

## 5. Struttura del repository

```text
coccolebestiali/
├── ARCHITECTURE.md              questo documento
├── readme.md                    introduzione storica e avvio demo
├── deploy/
│   └── build-netsons-package.sh packaging per il deploy
├── html/                        frontend React/TypeScript/Vite
│   ├── src/html/                entry HTML multi-page
│   ├── src/tsx/                 bootstrap React per ogni pagina
│   ├── src/pages/               pagine applicative
│   ├── src/components/          componenti condivisi
│   ├── src/auth/                helper OAuth e CSRF
│   ├── src/css/                 CSS per area funzionale
│   ├── src/assets/              immagini e favicon
│   └── scripts/                 screenshot browser
└── php/                         backend Laravel
    ├── app/Http/Controllers/    controller e validazione HTTP
    ├── app/Models/              dominio, query e operazioni DB
    ├── routes/api.php           pagine e API
    ├── migration/               schema cumulativo, seed e snapshot
    ├── storage/app/public/      file pubblici
    ├── storage/app/private/     documenti riservati
    └── tests/Feature/           test di integrazione
```

## 6. Frontend

### 6.1 Architettura multi-page

Il frontend non è una SPA con router globale. Vite costruisce più entry HTML, ciascuno con un root React autonomo.

| URL/Pagina | HTML | Bootstrap | Componente principale |
| --- | --- | --- | --- |
| `/` | `index.html` | `tsx/main.tsx` | `HomePage.tsx` |
| `/register` | alias HTTP `302` | — | redirect a `/?auth=register` |
| `/profile/petowner` | `profile-petowner.html` | `tsx/profile-petowner.tsx` | `PetOwnerProfilePage.tsx` |
| `/profile/petassistant` | `profile-petassistant.html` | `tsx/profile-petassistant.tsx` | `ProfilePlaceholderPage.tsx` |
| `/search` | `search.html` | `tsx/search.tsx` | `PetAssistantSearchPage.tsx` |
| `/pet-assistants/{id}` | `pet-assistant-detail.html` | `tsx/pet-assistant-detail.tsx` | `PublicPetAssistantPage.tsx` |
| demo | `demo.html` | `tsx/demo.tsx` | `DemoPage.tsx` con Inertia |
| template | `template_empty.html` | `tsx/template_empty.tsx` | `TemplateEmptyPage.tsx` |
| `/cmsadminsite` | `cmsadminsite.html` | script inline/jQuery | CMS amministrativo |

### 6.2 Responsabilità delle pagine

- `HomePage`: stato sessione, viste URL `auth=login|register`, login e registrazione neutra email/Google/Apple, password dimenticata/temporanea, logout, switch Owner/Assistant, CTA di onboarding e call to action contestuale. Il contenuto autenticato usa `modes.current`; la CTA “Diventa/Completa Pet Assistant” appare solo prima della pubblicazione e scompare appena la capability Assistant diventa `active` e lo switch è disponibile.
- `PetOwnerProfilePage`: dati personali, coordinate, credenziali, pet, preferiti, prenotazioni e cancellazione account.
- `ProfilePlaceholderPage`: profilo Pet Assistant; dati personali, dati operatore, servizi, prezzi, galleria, geolocalizzazione, calendario, prenotazioni e account.
- `PetAssistantSearchPage`: filtri per date, servizi, caratteristiche, foto, preferiti e ranking; salva lo stato utile alla navigazione.
- `PublicPetAssistantPage`: profilo pubblico, statistiche risposta, recensioni, galleria, mappa, servizi, preferito e form di prenotazione multipla.
- `cmsadminsite.html`: login amministrativo e pannelli per messaggi, errori, cataloghi, servizi, policy e dati demo.

### 6.3 Componenti condivisi principali

| Componente | Responsabilità |
| --- | --- |
| `BookingsSection` | elenco e azioni prenotazioni; riceve `perspective=owner|assistant` |
| `ProfileModeSwitcher` | switch di modalità sui due profili e ingresso “Diventa Pet Assistant”; aggiorna una preferenza di sessione non autorizzativa |
| `AssistantBookingForm` | selezione pet/servizi/slot e invio batch idempotente |
| `HomeActiveBookings` | richieste attive mostrate nella home Assistant |
| `PetAssistantFavorites` | elenco/rimozione preferiti Owner |
| `PetOwnerPetsSection` | CRUD pet, gallery, foto profilo e documenti |
| `AccountChangeModal` | passaggio tra credenziali email, Google e Apple |
| `RemoveAccountModal` | cancellazione definitiva dell'account |
| `PasswordVisibilityField` | input password condiviso |
| `ProfileFieldMeta` | metadati e helper dei campi profilo |
| `RankingStars` | rappresentazione visuale del ranking |
| `PublicFooter` | footer delle pagine pubbliche |

### 6.4 Stato e comunicazione

- Le pagine usano stato React locale e `fetch` diretto.
- Non esiste uno store globale condiviso tra entry page.
- L'autenticazione viene riletta tramite `GET /api/auth/me`.
- Le mutazioni inviano prevalentemente JSON o `FormData` per gli upload.
- Gli errori frontend di autenticazione possono essere registrati con `POST /api/auth/frontend-error`.
- Le navigazioni tra aree usano link e `window.location`, non un router client.
- Leaflet gestisce mappe e marker nei profili e nel profilo pubblico.

## 7. Backend e responsabilità

### 7.1 Controller HTTP

| Controller | Funzioni pubbliche e parametri principali |
| --- | --- |
| `AuthController` | `getPublicAuthConfig()`; `registerEmail(Request)`; `loginEmail(Request)`; `requestTemporaryPassword(Request)`; `completeTemporaryPassword(Request)`; registrazione/login/cambio account Google e Apple; `verifyEmail(Request)`; `getCurrentUser(Request)`; `logout(Request)`; `deleteCurrentAccount(Request)`; logging errori frontend |
| `ProfileController` | lettura/salvataggio dati personali Owner/Assistant; cambio password; opzioni catalogo; CRUD pet e file; dati operatore; calendario mensile/giornaliero/copia; ricerca comuni; geocoding |
| `PetAssistantSearchController` | `getOptions(Request)`; `search(Request)` |
| `PublicPetAssistantController` | `show(Request, assistantId)`; `availability(Request, assistantId)`; `favorites(Request)`; `setFavorite(Request, assistantId)` |
| `BookingController` | `index(Request)` con `perspective`; `activeForAssistant(Request)`; `store(Request)`; `storeBatch(Request)`; azioni validate per lato Owner/Assistant; recensione contestuale; modalità conferma; token email |
| `MessageController` | invio contatto; elenco/cancellazione/riposta messaggi CMS |
| `AdminController` | sessione admin; cataloghi; servizi; policy; errori; clear/restore/seed demo |

I controller validano l'input, traducono eccezioni in JSON/codici HTTP e delegano la logica ai modelli. Alcuni controller risolvono l'utente in modo indipendente; questa duplicazione è debito tecnico da centralizzare.

### 7.2 Modelli e servizi di dominio

| Classe | Funzioni/parametri caratterizzanti |
| --- | --- |
| `UserAccount` | autenticazione email; registrazione neutra; social upsert non distruttivo; login/cambio provider; lookup utente con capability e modalità; verifica email; password temporanea; cancellazione completa account/file |
| `UserCapability` | provisioning Owner idempotente; lettura stati Owner/Assistant; `hasActive()` per policy puntuali; `activeForUser()`; `scopeActive()` per query capability-aware; assenza di righe = nessun accesso |
| `ProfileData` | `read(userId,context)`; `write(userId,context,payload,timestamp)`; `syncCommonPhoto()`; `ownerLocation()`; separazione rigida tra dati comuni e location contestuali |
| `ProfileReputation` | `score(userId,capability)`; inizializzazione idempotente; applicazione delta contestuale; evento audit |
| `Profile` | `getPersonalProfile(userId,context)`; opzioni; CRUD pet; gallery/documenti; `getOperatorProfile(userId)`; `savePersonalProfile(userId,payload,context)`; credenziali; `saveOperatorProfile(userId,payload)`; calendario |
| `PetAssistantSearch` | `getOptions(userId=0)`; `search(startDate,endDate,serviceIds,petId,userId,duration,sortBy,onlyWithPhoto,optionFilters,onlyFavorites,showFavoriteStatus)`; disponibilità; distanza; compatibilità pet; servizi |
| `PublicPetAssistant` | query base profili; dettaglio; preferiti; statistiche risposta; recensioni pubblicate; etichette catalogo |
| `Booking` | riconciliazione; creazione singola/batch; `listForUser(userId,perspective,activeOnly)`; autorizzazione capability+lato; divieto self-booking; accept/decline/cancel; riprogrammazione; review contestuale; confirmation mode; token; controllo slot/prezzi/sovrapposizioni; reputazione; email ciclo vita |
| `PortalPolicy` | definizioni statiche, valori DB/fallback, righe CMS e snapshot pubblico |
| `Admin` | CRUD cataloghi/servizi; policy con log e notifica email; errori |
| `DemoData` | svuotamento dati; seed; snapshot SQL; ripristino storage; riepilogo |
| `Message` | messaggi contatto e risposte amministrative |
| `Utility` | registrazione centralizzata degli errori applicativi |

### 7.3 Scheduler

Il modello `Booking::reconcile()`:

- scade le richieste manuali oltre `response_deadline`;
- applica l'eventuale penalità Assistant;
- invia le email di ciclo vita;
- porta a `completed` le prenotazioni confermate terminate.

La documentazione di migrazione prescrive `php artisan schedule:work` o cron `php artisan schedule:run`. Verificare `routes/console.php` quando si cambia la frequenza.

## 8. Catalogo delle route e delle API

### 8.1 Route pagina/file

- `GET /`, `/profile/petowner`, `/profile/petassistant`, `/search`: servono entry HTML compilati.
- `GET /register`: alias compatibile che reindirizza con `302` a `/?auth=register`.
- `GET /pet-assistants/{assistantId}`: verifica l'esistenza del profilo e serve il dettaglio.
- `GET /cmsadminsite`: serve il CMS sorgente o dist.
- `GET /asset/{path}`: file da `asset/` con controllo anti path traversal.
- `GET /storage/{path}`: file del disco pubblico Laravel.
- `GET /utility.js`: utility JavaScript storica.
- `GET /up`: health check Laravel.

### 8.2 Autenticazione

| Metodo e path | Input essenziale | Output/effetto |
| --- | --- | --- |
| `GET /api/auth/config` | nessuno | client ID OAuth e flag Apple mock |
| `GET /api/auth/me` | sessione server | utente corrente, capability/stati e modalità disponibili/default/corrente |
| `POST /api/auth/register/email` | `email,password` | crea account globale non verificato con capability Owner e invia email neutra |
| `POST /api/auth/register/google` | `idToken/accessToken` | crea/collega account social senza mutare capability di account esistenti |
| `POST /api/auth/register/apple` | `identityToken,user?,state` | crea/collega account social senza mutare capability di account esistenti |
| `POST /api/auth/login/email` | `email,password` | sessione e utente |
| `POST /api/auth/login/google` | token | sessione e utente esistente |
| `POST /api/auth/login/apple` | token | sessione e utente esistente |
| `GET /api/auth/verify-email` | `email,expires,signature` | verifica email con firma HMAC neutra e redirect al login |
| `POST /api/auth/password/forgot` | `email` | password temporanea inviata senza enumerazione esplicita |
| `POST /api/auth/password/temporary` | password e conferma | sostituzione password temporanea |
| `POST /api/auth/account/{email|google|apple}` | credenziali/token | cambia metodo di accesso dell'account corrente |
| `POST /api/auth/logout` | sessione | invalida la sessione e cancella eventuali cookie applicativi legacy |
| `DELETE /api/auth/account` | sessione | elimina account, dominio e file associati |
| `POST /api/auth/frontend-error` | `context,message,details?` | registra diagnostica |

Gli endpoint `apple/mock` replicano registrazione, login e cambio account se `APPLE_MOCK_AUTH` è abilitato.

I token Apple reali sono verificati crittograficamente contro il JWKS ufficiale Apple tramite `firebase/php-jwt`; issuer, audience, scadenza, firma e nonce legato alla sessione devono essere validi. Ogni flusso usa inoltre uno `state` monouso. Il login social usa la coppia esatta provider/subject; per gli account legacy privi del collegamento è ammesso un solo collegamento automatico quando il provider certifica l'email come verificata. Un'email non verificata o proveniente dal solo payload client non è mai sufficiente. Le route pubbliche sensibili applicano rate limiting per IP.

### 8.3 Profili e pet

- `GET|POST /api/profile/petowner/personal`: profilo personale Owner.
- `POST /api/profile/petowner/password`: cambio password Owner.
- `GET /api/profile/petowner/pets/options`: gruppi pet/tipi/taglie e metadati documento.
- `GET|POST /api/profile/petowner/pets`: lettura e salvataggio collezione pet; il POST può includere file.
- `POST /api/profile/petowner/pets/profile-photo`: selezione foto profilo principale.
- `GET /api/profile/petowner/pets/documents/{documentId}`: download privato autorizzato.
- `GET|POST /api/profile/petassistant/personal`: profilo personale Assistant.
- `POST /api/profile/petassistant/password`: cambio password Assistant.
- `GET|POST /api/profile/petassistant/operator`: profilo professionale, servizi, opzioni e gallery.
- `GET /api/profile/operator/options`: cataloghi necessari al profilo Assistant.
- `GET /api/profile/cities?query=`: autocomplete comuni italiani.
- `GET /api/profile/geocode?city=&address=&addressNumber=`: coordinate indirizzo verificato.
- `GET /api/profile/petassistant/calendar?year=&month=`: panoramica mensile.
- `GET|POST /api/profile/petassistant/calendar/day`: dettaglio/salvataggio giornata.
- `POST /api/profile/petassistant/calendar/copy`: copia una giornata su date target.

### 8.4 Ricerca, profilo pubblico e preferiti

- `GET /api/search/pet-assistants/options`: servizi, pet dell’account autenticato, `activeCapabilities`, `canUseOwnerDiscovery`, `canFilterFavorites` e policy.
- `POST /api/search/pet-assistants`: date, servizi, durata, pet, ordinamento, foto, feature e preferiti.
- `GET /api/pet-assistants/{assistantId}`: profilo pubblico completo; per il visitatore include `viewerCapabilities`, `viewerAuthenticated`, `canFavorite`, `canBook` e `isOwnProfile`.
- `GET /api/pet-assistants/{assistantId}/availability?startDate=&endDate=`: slot del profilo.
- `GET /api/pet-assistant-favorites`: preferiti dell'account con capability Owner attiva; protetta da `portal.auth` e `portal.capability:owner`.
- `PUT /api/pet-assistants/{assistantId}/favorite`: `{favorite:boolean}`; stessa policy Owner e risposta `422` se account Owner e Assistant coincidono.

### 8.5 Prenotazioni

- `GET /api/bookings?perspective=owner|assistant`: inbox separata per capability; la prospettiva è obbligatoria.
- `GET /api/bookings/active-for-assistant`: richieste attive Assistant, protetta da sessione e capability Assistant.
- `POST /api/bookings`: prenotazione singola storica con `perspective=owner`; richiede capability Owner.
- `POST /api/bookings/batch`: batch idempotente con `perspective=owner`, `requestKey` UUID e uno o più servizi.
- `POST /api/bookings/confirmation-mode`: `perspective=assistant`, `mode=manual|automatic`.
- `POST /api/bookings/{id}/accept|decline`: solo `perspective=assistant` e lato Assistant della prenotazione.
- `POST /api/bookings/{id}/cancel`: `perspective=owner|assistant`, verificata rispetto al lato occupato.
- `GET /api/bookings/{id}/alternatives?perspective=assistant`.
- `POST /api/bookings/{id}/reschedule`: solo Assistant; `/reschedule/respond`: solo Owner.
- `POST /api/bookings/{id}/review`: prospettiva, sentiment, testo e consenso pubblicazione; reviewer e reviewed capability sono persistite.
- `GET|POST /api/bookings/action/{token}`: visualizzazione/consumo azione email monouso.

Payload batch caratterizzante:

```json
{
  "perspective": "owner",
  "assistantUserId": 15,
  "petId": 1,
  "requestKey": "uuid",
  "items": [
    {
      "serviceId": 1,
      "slotId": 10,
      "date": "YYYY-MM-DD",
      "startTime": "09:00",
      "endTime": "10:00",
      "featureIds": [1, 2],
      "message": "...",
      "expectedTotalCents": 2500
    }
  ]
}
```

### 8.6 CMS

Le API `/api/admin/*` comprendono:

- login, logout e stato sessione admin;
- messaggi, risposte ed eliminazione;
- errori ed eliminazione;
- CRUD servizi e collegamenti feature;
- CRUD e riordino tipi pet e caratteristiche casa;
- CRUD feature servizio;
- lettura/salvataggio policy;
- svuotamento DB, ripristino configurazione e seed demo.

## 9. Autenticazione e autorizzazione attuali

### 9.1 Account

`users.email` è univoca. Sono supportati:

- email/password con hash Laravel;
- Google, verificato tramite token Google e audience configurata;
- Apple, verificato tramite identity token e audience;
- un solo collegamento social attivo per account dopo il cambio metodo.

La registrazione email richiede almeno 10 caratteri, maiuscola, minuscola, numero, simbolo e nessuno spazio. Il backend crea direttamente la capability Owner; il parametro `role` è proibito. La conferma email usa una firma HMAC neutra con scadenza. La password dimenticata genera una password temporanea e imposta `password_reset_required`.

### 9.2 Sessione corrente

Il backend salva l'identità esclusivamente in `cb_portal_user_id` nella sessione Laravel. `cb_portal_ui_mode` conserva soltanto la preferenza visuale `owner|assistant` e non concede permessi. `App\Support\PortalSession` è il resolver unico: non consulta cookie applicativi, `$_COOKIE`, header raw o ruolo fornito dal client. Login e verifica email rigenerano l'ID di sessione; logout e cancellazione account invalidano la sessione e rigenerano il token CSRF.

I cookie applicativi storici `cb_portal_user_id` e `cb_portal_user_role` non vengono creati né consultati. L'identità viaggia soltanto tramite il cookie di sessione Laravel, configurato `HttpOnly` e `SameSite=Lax`; in produzione `SESSION_SECURE_COOKIE` deve essere abilitato sotto HTTPS.

`App\Http\Middleware\RequirePortalSession` protegge a livello route profili, account, preferiti e prenotazioni. `RequireActiveCapability`, alias `portal.capability`, autorizza le route per capability attiva; `RequireAssistantProfileAccess` consente ai soli stati `draft|pending_verification|active` di compilare il profilo Assistant senza renderlo pubblico. Gli endpoint Owner richiedono capability Owner attiva. La stessa regola è ripetuta nel dominio per difesa in profondità. Tutte le richieste mutative usano il token `XSRF-TOKEN`/`X-XSRF-TOKEN`; il frontend centralizza il comportamento in `csrfFetch`, incluso OAuth e CMS.

### 9.3 Amministrazione

Il CMS usa la chiave di sessione `cb_admin_authenticated`, incapsulata in `App\Support\AdminSession`. Login e logout rigenerano rispettivamente sessione/token; `RequireAdminSession` protegge tutte le API dati, messaggi e operazioni demo. Le credenziali provengono da `CMS_ADMIN_USERNAME` e `CMS_ADMIN_PASSWORD`; i fallback presenti nel codice sono adatti soltanto allo sviluppo e devono essere sovrascritti in produzione.

## 10. Modello di dominio e regole

### 10.1 Capability e modalità

`user_capabilities` è la fonte autorizzativa unica. Ogni risposta utente include `capabilities`, `activeCapabilities` e `modes`; `modes.current` proviene dalla preferenza di sessione e non concede permessi. Discovery, preferiti, booking, profili e onboarding usano `UserCapability` come policy centralizzata. Un account senza la capability richiesta fallisce in modo chiuso.

### 10.2 Pet Owner

- Un Owner può possedere fino a 20 pet nel payload corrente.
- Ogni pet ha anagrafica, taglia, gruppi pet, caratteristiche, gallery e documenti.
- Il catalogo comprende 40 gruppi trasversali a tutti gli animali da compagnia supportati. Per i cani segue i dieci gruppi della [nomenclatura FCI](https://www.fci.be/en/nomenclature/), per i gatti aggrega le categorie della [classificazione FIFe](https://fifeweb.org/cats/breeds/) e per le altre specie usa le famiglie di companion animals previste dalla [classificazione europea](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=OJ:L_202601115). La categoria “Altri pet” copre solo animali legalmente detenibili come compagnia.
- Un Pet Assistant classifica ogni gruppo in modo esplicito come `accepted` o `rejected`; lo stesso gruppo non può appartenere a entrambi gli insiemi. L’assenza da entrambi significa “non dichiarato”, non accettazione implicita.
- Le due liste del profilo Assistant espongono nomi comprensibili senza numerazione FCI e hanno filtri indipendenti per razza o gruppo. Le razze più comuni sono termini di ricerca: individuano il gruppo corretto senza reintrodurre associazioni per singola razza nel database.
- Il matching della ricerca richiede che il gruppo del pet sia accettato e non sia rifiutato. Le associazioni storiche vengono convertite in `accepted`; il sistema non inventa rifiuti per profili reali preesistenti.
- Una sola foto gallery può essere principale per la visualizzazione.
- I documenti sono privati e scaricabili soltanto dal proprietario.
- I preferiti sono coppie Owner/Assistant tra account distinti: servono capability Owner attiva e Assistant attiva, il self-favorite è vietato da controller, modello e check DB.

### 10.3 Pet Assistant

- Può essere persona o associazione.
- Configura dati fiscali, associati, qualifiche, esperienza, pet accettati, casa, servizi, prezzi, feature e gallery.
- Il profilo pubblico usa il punto approssimativo salvo consenso esplicito alla posizione esatta.
- La modalità di conferma prenotazione è `manual` o `automatic`.
- Il calendario è per giorno, fasce e servizi abilitati con prezzo congelabile nello slot.

### 10.4 Prenotazione

- Numero progressivo annuale tramite `booking_counter`.
- Intervalli a blocchi di 30 minuti e durata massima configurabile.
- Il prezzo viene calcolato dal backend; `expectedTotalCents` rileva variazioni durante il checkout.
- Le feature richieste vengono congelate per nome nella prenotazione.
- Il batch è idempotente per `(owner_user_id, request_key)` e hash payload.
- Owner e Assistant devono essere account distinti; il self-booking è vietato da UI, dominio e check DB.
- Ogni lettura o azione dichiara `perspective=owner|assistant`; capability attiva e lato della prenotazione devono coincidere.
- Accettazione e rifiuto non partono direttamente dalla card: sia Assistant sia Owner devono confermare l'azione in una modale riepilogativa prima dell'invio API.
- La transazione impedisce sovrapposizioni sul calendario dell'Assistant.
- In modalità automatica la prenotazione nasce confermata; in manuale nasce pending con deadline.
- Le riprogrammazioni conservano prezzo e stato precedente necessari alla decisione.

Stati osservati nel dominio:

- `pending`
- `confirmed`
- `reschedule_pending`
- `declined`
- `cancelled`
- `expired`
- `completed`

### 10.5 Recensioni e ranking

- Una recensione è consentita dopo un servizio completato ed entro la finestra configurata.
- Il reviewer e il destinatario devono essere partecipanti alla prenotazione.
- Il sentiment è `positive|negative`.
- Il testo pubblico richiede `publish_comment=1`.
- Il punteggio è limitato a `0..100` e ogni variazione genera un `reputation_event`.
- Dallo STEP 5 il punteggio è separato per capability Owner/Assistant in `profile_reputation`.
- Dallo STEP 7 `booking_review` persiste `reviewer_capability` e `reviewed_capability`; il testo pubblico è ammesso soltanto per recensioni Owner→Assistant.
- Ogni evento dichiara `subject_capability`; non esiste un punteggio globale ambiguo dell'account.

### 10.6 Policy configurabili

| Chiave | Default | Range | Significato |
| --- | ---: | ---: | --- |
| `booking_min_notice_hours` | 24 | 1–168 | anticipo minimo |
| `manual_response_hours` | 24 | 1–168 | tempo risposta manuale |
| `assistant_cutoff_hours` | 3 | 1–72 | cutoff Assistant |
| `owner_free_cancellation_hours` | 24 | 0–168 | annullamento Owner senza penalità |
| `owner_late_cancellation_penalty` | 5 | 0–50 | penalità Owner |
| `assistant_late_action_penalty` | 5 | 0–50 | penalità Assistant |
| `positive_review_points` | 5 | 0–50 | premio recensione positiva |
| `negative_review_penalty` | 5 | 0–50 | penalità recensione negativa |
| `initial_reputation_score` | 60 | 0–100 | ranking iniziale |
| `review_window_days` | 30 | 1–365 | finestra recensione |
| `max_booking_duration_minutes` | 480 | 30–1440 | durata massima |

## 11. Database

### 11.1 Gestione dello schema

La fonte cumulativa è `php/migration/migration.txt`. Il progetto non usa attualmente migration Laravel versionate. Lo script:

- sostituisce `{{DB_DATABASE}}` con `DB_DATABASE`;
- crea tabelle con `CREATE TABLE IF NOT EXISTS`;
- applica alter condizionali interrogando `information_schema`;
- include cataloghi iniziali e aggiornamenti compatibili;
- deve restare rieseguibile.

Lo schema legacy affida gran parte dell'integrità a indici, vincoli univoci e codice applicativo. Le tabelle additive `user_capabilities`, `account_profile`, `owner_profile` e `assistant_profile` introducono invece FK esplicite verso `users` con `ON DELETE CASCADE`; ogni nuova relazione deve mantenere documentata questa scelta.

### 11.2 Catalogo completo delle tabelle applicative

#### Account, profili e diagnostica

| Tabella | Chiavi/campi principali | Relazioni e funzione |
| --- | --- | --- |
| `users` | `id`, `name`, `email` unique, verifiche, password, avatar, timestamp Unix | identità e credenziali dell'account globale |
| `user_capabilities` | PK `(user_id, capability)`, stato, versione/step onboarding, timestamp di ciclo vita | fonte autorizzativa unica Owner/Assistant; FK verso `users` |
| `social_accounts` | provider+sub unique, `user_id`, email/claims provider | identità Google/Apple |
| `account_profile` | PK/FK `user_id`, nome, foto, età, telefono, timestamp | dati personali condivisi tra prospettive; fonte primaria dallo STEP 4 |
| `owner_profile` | PK/FK `user_id`, città, indirizzo, coordinate | residenza/location usata dalla prospettiva Owner |
| `assistant_profile` | PK/FK `user_id`, città, sede, coordinate, raggio | area operativa/location usata da ricerca e profilo Assistant |
| `operatordata` | `user_id` unique, tipo, CF, ragione sociale, P.IVA, bio, esperienza, taglia, confirmation mode | profilo professionale Assistant |
| `operatorassociatedata` | `user_id`, nominativo e CF | membri di un'associazione |
| `operator_public_profile` | PK `user_id`, headline, giornata tipo, sicurezza/casa, istruzioni, consenso punto esatto | estensione pubblica Assistant |
| `message` | nome, email, testo | richieste contatto |
| `messageback` | `messageid`, risposta | risposta amministrativa |
| `error` | parametri, messaggio, metodo, timestamp | diagnostica applicativa |

#### Cataloghi e configurazione Assistant

| Tabella | Funzione |
| --- | --- |
| `operatortitle` / `operatortitledata` | catalogo qualifiche e relazione Assistant-qualifica |
| `petbreed` / `petbreeddata` | catalogo gruppi pet per categoria animale e stato esplicito `accepted/rejected`; nomi fisici storici mantenuti per upgrade compatibile |
| `pettype` / `pettypedata` | catalogo caratteristiche e caratteristiche accettate |
| `housefeature` / `housefeaturedata` | catalogo e caratteristiche abitazione |
| `operatorgallery` | foto, caption e ordine gallery Assistant |

Le tabelle relazione usano vincoli univoci compositi per impedire duplicati. Le qualifiche comprendono `Operatore Olistico` e sono metadati pubblici mostrati nella ricerca e nell'intestazione del profilo Assistant; non determinano servizi, prezzi o autorizzazioni alla prenotazione.

I campi di `operator_public_profile` sono contenuti descrittivi facoltativi mostrati al Pet Owner prima della prenotazione. Non vengono congelati nella prenotazione e non partecipano a disponibilità, compatibilità o calcolo del prezzo.
La bio, pur essendo memorizzata in `operatordata.bio`, è presentata nello stesso gruppo visuale dei contenuti pubblici, subito dopo la headline, perché viene mostrata come corpo principale della presentazione Assistant.
Il consenso `publish_exact_location`, pur restando nella stessa tabella, è gestito nell'interfaccia accanto alla mappa Assistant e viene persistito anche dal salvataggio dei Dati personali; il salvataggio aggiorna soltanto questo flag e non sovrascrive gli altri contenuti pubblici.

#### Pet Owner

| Tabella | Campi principali | Relazioni |
| --- | --- | --- |
| `ownerpet` | `user_id`, nome, sesso, data nascita, microchip, note, taglia, ordine | molti pet per utente |
| `ownerpetbreeddata` | `pet_id`,`petbreed_id` unique | gruppi del pet; nome fisico storico |
| `ownerpettypedata` | `pet_id`,`pettype_id` unique | caratteristiche del pet |
| `ownerpetgallery` | `pet_id`, percorso foto, `is_profile`, ordine | gallery pubblica |
| `ownerpetdocument` | `pet_id`, tipo, titolo, date, note, path, nome/mime/size | documenti privati |

#### Servizi e disponibilità

| Tabella | Campi/relazione |
| --- | --- |
| `service` | nome, descrizione, `requires_home_photo` |
| `servicefeature` | catalogo opzioni/feature |
| `servicefeaturedata` | relazione unique servizio-feature |
| `operatorservicedata` | unique Assistant-servizio, prezzo orario, abilitazione foto casa |
| `operatorservicefeaturedata` | unique Assistant-servizio-feature |
| `calendar_day` | unique Assistant-data, abilitazione |
| `calendar_day_slot` | fascia, abilitazione, ordine, collegata al giorno |
| `calendar_day_slot_service` | unique slot-servizio, abilitazione e prezzo |

#### Prenotazioni, recensioni e reputazione

| Tabella | Campi/relazione |
| --- | --- |
| `booking_counter` | anno e ultimo progressivo |
| `booking` | numero unique, Owner, Assistant distinti tramite check, pet, servizio, slot, data/orari, durata, prezzi, stato, deadline, cancellazione, batch, prima risposta |
| `booking_batch` | Owner, request UUID e hash; unique Owner-request |
| `booking_feature_preference` | unique booking-feature e nome snapshot |
| `booking_reschedule` | proposta, proponente, nuovo slot/prezzo, stato precedente e stato proposta |
| `booking_review` | booking, reviewer/reviewed con capability esplicita, sentiment, commento, delta, consenso pubblicazione; unique booking-reviewer; indice target+capability |
| `profile_reputation` | PK/FK `(user_id, capability)`, score 0–100; reputazione primaria separata Owner/Assistant e indice capability-score per discovery |
| `reputation_event` | utente, `subject_capability`, booking, attore, tipo, delta, score risultante e nota |
| `booking_action_token` | token hash unique, booking, utente, azione, scadenza e consumo |
| `pet_assistant_favorite` | PK composita Owner-Assistant e check `owner_user_id <> assistant_user_id` |

#### Policy e audit

| Tabella | Funzione |
| --- | --- |
| `portal_policy` | valore corrente per policy key |
| `policy_change_log` | batch UUID, JSON differenze, conteggi destinatari/consegne/errori e timestamp |

### 11.3 Tabelle infrastrutturali Laravel

Sessione, cache e code hanno driver `database` come default. Le tabelle infrastrutturali (`sessions`, `cache`, `jobs`, failed jobs) devono essere presenti nell'ambiente se i default non vengono sovrascritti. Non fanno parte del catalogo applicativo cumulativo sopra e vanno verificate nel provisioning.

### 11.4 Relazioni principali

```text
users
├── social_accounts
├── account_profile (dati comuni, FK cascade)
├── owner_profile (residenza, FK cascade)
├── assistant_profile (area operativa, FK cascade)
├── ownerpet
│   ├── ownerpetbreeddata -> petbreed
│   ├── ownerpettypedata  -> pettype
│   ├── ownerpetgallery
│   └── ownerpetdocument
├── operatordata
├── operator_public_profile
├── operatorassociatedata
├── operator*data / gallery / calendar_day
├── booking.owner_user_id
├── booking.assistant_user_id
├── pet_assistant_favorite (entrambi i lati)
├── profile_reputation (Owner/Assistant, FK cascade)
└── reputation_event

booking
├── booking_feature_preference
├── booking_reschedule
├── booking_review
└── booking_action_token
```

### 11.5 Timestamp e denaro

- La maggior parte dei timestamp è memorizzata come intero Unix.
- Le date operative usano `date`; gli orari usano stringhe `HH:mm`.
- I prezzi sono `decimal(10,2)` nel DB.
- Il client batch invia anche `expectedTotalCents` intero per il controllo di coerenza.
- Il dominio prenotazioni usa esplicitamente il fuso `Europe/Rome`.

## 12. File storage

| Contenuto | Disco | Path tipico | Accesso |
| --- | --- | --- | --- |
| gallery pet | `public` | `owner-pet-gallery/...` | `/storage/{path}` |
| gallery operatore | `public` | `operator-gallery/...` | `/storage/{path}` |
| documenti pet | `local` privato | `owner-pet-documents/user-{id}/...` | endpoint autenticato di download |
| avatar OAuth remoto | URL in `users.avatar` | provider esterno | browser/provider |

Il database conserva percorsi relativi, non blob. La cancellazione account raccoglie i riferimenti, cancella i record in transazione e poi tenta di rimuovere i file, registrando quelli non eliminati.

Gli upload pet ammettono immagini fino a 4 MB e documenti PDF/JPG/PNG/WebP fino a 10 MB. Ogni modifica ai limiti deve riallineare validazione backend, messaggi frontend e questo documento.

## 13. Integrazioni esterne

| Integrazione | Uso | Configurazione/nota |
| --- | --- | --- |
| Google Identity | registrazione/login/cambio account | `GOOGLE_CLIENT_ID`; script Google caricato nelle entry pubbliche |
| Apple Sign In | registrazione/login/cambio account | `APPLE_CLIENT_ID`, `APPLE_REDIRECT_URI`, mock opzionale |
| ANPR/open data comuni | autocomplete e contesto città italiane | HTTP con cache 24 ore |
| Nominatim/OpenStreetMap | geocoding indirizzi | cache 7 giorni, normalizzazione e confronto strada/città |
| Leaflet/OSM | mappe client | nessun token nel codice |
| Laravel Mail | conferme, password, ciclo prenotazione, policy, risposte CMS | provider tramite `MAIL_*`; default log |
| CDN CMS | jQuery, DataTables, Moment, Tailwind 2 | dipendenze runtime del CMS |

Le chiamate HTTP hanno timeout applicativi. Quando viene aggiunta un'integrazione vanno documentati timeout, retry, cache, gestione errori, dati trasmessi e implicazioni privacy.

## 14. Configurazione e variabili d'ambiente

Gruppi rilevanti, senza valori:

- applicazione: `APP_NAME`, `APP_ENV`, `APP_KEY`, `APP_URL`, `APP_TIMEZONE`, locale/debug;
- database: `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`;
- sessione: `SESSION_DRIVER`, lifetime, domain, secure, http-only, same-site;
- cache/queue: `CACHE_STORE`, `QUEUE_CONNECTION` e relativi parametri;
- mail: `MAIL_MAILER`, host, port, credenziali, mittente;
- OAuth: Google e Apple;
- CMS: username/password admin;
- storage/cloud: `FILESYSTEM_DISK`, AWS/S3 opzionale;
- logging: canale, livello e servizi remoti opzionali.

Il fuso applicativo Laravel ha default `UTC`, mentre il dominio prenotazioni usa `Europe/Rome`. In produzione impostare esplicitamente `APP_TIMEZONE=Europe/Rome` o mantenere una conversione centralizzata e testata.

## 15. Dataset, seed e operazioni DB

- `migration.txt`: schema cumulativo e seed strutturali.
- `seed_system_configuration.sql`: cataloghi, servizi e policy.
- `seed_demo_data.sql`: 41 account globali, Rex, 40 profili Assistant e dati operativi.
- `seed_demo_holistic.sql`: estensione operatori olistici e disponibilità.
- `seed_pet_assistants.php`: rigenerazione distruttiva dei 40 profili locali.
- `seed_pet_assistant_calendars.php`: rigenera soltanto i calendari dalla data corrente al 31 dicembre 2027, garantendo disponibilità attiva sulla data finale per tutti i profili Assistant demo.
- `export_current_profiles.php`: esporta snapshot e file referenziati.
- `demo_storage/manifest.json`: inventario asset demo.

Le operazioni CMS `clear-all`, `restore-system` e `seed` sono distruttive o materialmente mutative e devono restare protette dalla sessione admin. Lo schema definitivo è partizionato in nove tabelle di sistema e 37 operative:

- `clear-all` svuota dinamicamente tutte le tabelle presenti nello schema e azzera gli auto-increment;
- `restore-system` esegue prima lo svuotamento completo, poi carica soltanto cataloghi, servizi, feature, qualifiche, gruppi pet, tipologie, caratteristiche casa e policy;
- `seed` conserva le tabelle di sistema, svuota tutte le 37 tabelle operative, elimina gli asset utente dalle directory operative e ripristina dataset e storage demo validati dal manifest.

`DemoDataMaintenanceTest` confronta questa partizione con `migration.txt` e verifica che gli snapshot tocchino esclusivamente il proprio perimetro.

## 16. Test e verifiche

### Test backend presenti

`BookingFlowTest` copre:

- numero prenotazione e sovrapposizione;
- conferma automatica;
- congelamento feature e rifiuto feature non disponibili;
- cancellazioni, recensioni e reputazione;
- sessione e ruolo nelle API;
- anticipo minimo e blocchi temporali;
- riprogrammazione e prezzo congelato;
- token email monouso;
- policy admin, audit e notifiche;
- autenticazione admin server-side;
- batch, variazione prezzo, rollback e idempotenza;
- richieste attive Assistant;
- stabilità della prima risposta;
- consenso posizione esatta.

`ExampleTest` verifica la risposta della home.

### Comandi

```bash
cd php && composer test
cd html && npm run lint
cd html && npm run build
```

Ogni modifica di dominio deve aggiungere test di autorizzazione positivi e negativi, oltre al caso nominale.

## 17. Debito tecnico e rischi conosciuti

1. **Onboarding senza revisione amministrativa**: il gate è deterministico e server-side; eventuali verifiche documentali o fiscali esterne richiederanno un futuro stato `pending_verification` gestito dal CMS.
2. **Copertura end-to-end OAuth**: login email è verificabile localmente; Google e Apple richiedono collaudo manuale con credenziali/provider disponibili.
3. **Controller difensivi duplicati**: alcuni controlli di sessione rimangono nei controller oltre alle guardie di route e potranno essere centralizzati.
4. **Schema non versionato in classi Laravel**: lo script cumulativo e gli script di cutover rendono meno esplicita la sequenza delle release.
5. **FK non uniformi**: le tabelle account/capability usano FK cascade, mentre diverse relazioni storiche dipendono ancora dalla pulizia applicativa.
6. **Controller/modelli molto estesi**: `AuthController`, `ProfileController`, `Profile` e `Booking` hanno responsabilità ampie.
7. **CMS monolitico**: HTML/script inline e dipendenze CDN rendono più difficile testing e build riproducibile.
8. **Configurazione cookie di produzione**: `SESSION_SECURE_COOKIE=true` deve essere imposto nell'ambiente HTTPS di deploy.
9. **Advisory toolchain frontend**: `picomatch <=4.0.7` presenta `GHSA-fc5q-39xc-vjpf`; al 17 novembre 2026 non esiste una release corretta compatibile con Vite 8. La dipendenza è solo di sviluppo e non entra nel pacchetto pubblicato; aggiornare appena disponibile senza downgrade major automatici.

## 18. Architettura definitiva multi-profilo

Questa sezione registra l'architettura multi-profilo consolidata negli STEP 2–10.

### 18.1 Principi

Separare:

1. account e credenziali;
2. profilo personale condiviso;
3. capacità operative Owner/Assistant;
4. stato di onboarding e pubblicazione;
5. modalità UI corrente, che non costituisce autorizzazione.

Ogni account può agire come Owner. Il profilo Assistant è opzionale, salvabile in bozza e pubblicabile dopo il salvataggio dei campi obbligatori Alias e Città; la checklist estesa resta informativa.

### 18.2 Schema capability e dati contestuali

```text
user_capabilities
- user_id
- capability: owner | assistant
- status: draft | pending_verification | active | suspended | rejected | disabled
- onboarding_version
- current_step
- completed_at
- activated_at
- suspended_at
- created_at
- updated_at
PK (user_id, capability)
```

La tabella applicata usa inoltre una FK `ON DELETE CASCADE`, check constraint sui valori ammessi e l'indice `(capability, status, user_id)`. Il cutover STEP 10 ha completato il backfill prima di eliminare il ruolo storico; le nuove registrazioni creano Owner direttamente.

Separazione dati implementata nello STEP 4:

```text
account_profile     nome/foto/età/telefono condivisi
owner_profile       residenza/location Owner
assistant_profile   area operativa/location/raggio Assistant
```

`ProfileData` usa esclusivamente queste tabelle e richiede sempre il contesto esplicito. Ricerca e profilo pubblico consumano l'area Assistant; il calcolo distanza dell'Owner consuma la residenza Owner.

Reputazione contestuale implementata nello STEP 5:

```text
profile_reputation PK (user_id, capability)
reputation_event.subject_capability
```

`ProfileReputation` rende la coppia account/capability autoritativa. Ricerca e profilo pubblico leggono sempre il ranking Assistant; booking e penalità scelgono il contesto dal lato occupato nella prenotazione.

Discovery dual-role implementata nello STEP 6:

- `UserCapability::scopeActive()` filtra ricerca e profilo pubblico per capability Assistant `active`;
- un account con capability Assistant attiva è ricercabile senza cambiare identità;
- stato Assistant sospeso, disabilitato o parziale esclude il profilo;
- pet, filtro preferiti e gestione preferiti dipendono dalla capability Owner attiva;
- il self-favorite è escluso dall'API, dal dominio e dal database.

Prenotazioni dual-role implementate nello STEP 7:

- il contratto API richiede `perspective=owner|assistant` per inbox e azioni;
- il backend verifica sia la capability attiva sia la corrispondenza con `owner_user_id` o `assistant_user_id`;
- lo stesso account può avere contemporaneamente richieste inviate e ricevute in inbox separate;
- il self-booking è bloccato prima della transazione e dal check `chk_booking_distinct_participants`;
- recensioni e reputazione dichiarano esplicitamente la capability del reviewer e del destinatario;
- le email puntano alla pagina profilo e prospettiva corrette; i token di cancellazione derivano il lato dalla partecipazione, resa non ambigua dal divieto self-booking.

### 18.3 Onboarding Assistant

- Registrazione neutra “Account Coccole Bestiali”.
- Owner disponibile senza scelta irreversibile; pet richiesto just-in-time alla prenotazione.
- CTA “Diventa Pet Assistant” crea idempotentemente una capability `draft`; se la bozza esiste diventa “Completa profilo Pet Assistant”.
- I moduli esistenti costituiscono il wizard salvabile: identità, tipo operatore, dati fiscali, area, esperienza, servizi/prezzi, casa/gallery e calendario; `current_step` conserva l'ultima sezione.
- `AssistantOnboarding` calcola otto indicatori informativi server-side per la percentuale, senza mostrarne la griglia nel pannello; autorizza la pubblicazione in base ai soli Alias e Città persistiti e il client non può dichiarare la completezza.
- Profilo ricercabile solo con capability Assistant `active`.
- Switch Owner/Assistant come preferenza di sessione non autorizzativa; la modalità Assistant è selezionabile solo se attiva.
- Lo switch rilegge immediatamente capability e modalità quando la pubblicazione passa la bozza ad `active`, senza dipendere da un refresh del browser.
- Sospensione o disattivazione Assistant non elimina l'account Owner.

### 18.4 Impatti obbligatori

- `/auth/me` restituisce capacità, stati e modalità UI, non un ruolo esclusivo.
- Ricerca e profilo pubblico filtrano la capability Assistant attiva.
- Prenotazioni accettano `perspective=owner|assistant`.
- Impedire prenotazione, preferito e recensione verso se stessi.
- Separare location e reputazione per contesto.
- Il login social non deve mai rimuovere capacità esistenti.
- Distinguere disattivazione profilo dalla cancellazione account.
- Non unire automaticamente eventuali account doppi preesistenti.

### 18.5 Strategia di migrazione completata

1. Autenticazione/sessione corrette e coperte da test di caratterizzazione.
2. Schema capability introdotto in modo additivo.
3. Account esistenti sottoposti a backfill: tutti Owner attivi; gli Assistant storici anche Assistant attivi.
4. Letture e policy migrate progressivamente dalle strutture storiche alle capability.
5. Ricerca, profili, booking, reputazione, CMS, seed ed export adeguati.
6. Frontend neutro, onboarding e switch rilasciati e collaudati.
7. Campo ruolo, fallback, tabelle duplicate e compatibilità runtime rimossi nel cutover finale.

### 18.6 Ingresso alla registrazione

Con la registrazione neutra non sono più necessarie le due card Owner/Assistant della pagina autonoma. È implementato il seguente pattern:

- il click su **Registrati** nella home sostituisce la section `.hero-cta` con un pannello inline “Crea il tuo account”, analogamente al pannello di login già esistente;
- il pannello contiene un solo form email/password e le alternative Google/Apple, senza selezione permanente del ruolo;
- sia il pannello **Accedi** sia il pannello **Registrati** espongono un pulsante esplicito **Torna alla home** che ripristina la `.hero-cta` predefinita senza ricaricare la pagina;
- il ritorno alla home chiude la vista di autenticazione, rimuove il relativo stato dall'URL, ripristina il focus sul comando che l'aveva aperta e cancella sempre i campi password dalla memoria del componente;
- login e registrazione sono viste mutuamente esclusive dello stesso contenitore e condividono componenti, validazione, errori e OAuth;
- lo stato è rappresentato nell'URL, ad esempio `/?auth=register`, affinché refresh, back del browser, deep link e analytics restino corretti;
- `/register` non deve essere eliminata immediatamente: diventa un alias/redirect compatibile verso `/?auth=register`, preservando bookmark e link esterni;
- la registrazione ha una sola implementazione in `HomePage`; i vecchi sorgenti `RegisterPage`, entry HTML/TSX e CSS dedicato sono stati rimossi;
- su mobile il pannello rimane nel normale flusso verticale e la pagina può scorrere; non usare un modal per il form principale;
- dopo registrazione email si mostra uno stato persistente di conferma email; dopo registrazione social si applica il redirect previsto dal nuovo account globale;
- l'onboarding Pet Assistant resta un flusso successivo e separato, avviato dalla CTA “Diventa Pet Assistant”.

Una pagina autonoma potrà essere reintrodotta soltanto se in futuro la registrazione richiederà contenuti legali, editoriali o step sufficientemente estesi da non essere gestibili nella hero.

### 18.7 Registro del piano di consegna completato

La migrazione multi-profilo è stata eseguita per milestone compatibili e verificabili. Ogni milestone è stata chiusa con risultati automatici, checklist manuale e approvazione esplicita prima di procedere.

| Step | Obiettivo | Principali modifiche | Gate di approvazione |
| --- | --- | --- | --- |
| 0 | Baseline e sicurezza operativa | backup, fotografia schema/dati, test di caratterizzazione, inventario riferimenti a `role`, feature flag, piano rollback | build e test attuali verdi; backup verificato |
| 1 | Identità e sessione affidabili | eliminazione autenticazione da cookie ID/ruolo, sessione server-side, CSRF coerente, resolver utente unico, guard admin/utente | login email/Google/Apple, logout, profili e API protette verificati |
| 2 | Schema capability additivo | `user_capabilities`, stati/onboarding, backfill, indici; mantenimento temporaneo di `users.role` | conteggi e mapping utenti invariati; profili esistenti accessibili |
| 3 | Account neutro e compatibilità backend | registrazione senza ruolo esclusivo, `/auth/me` con capabilities, social login non distruttivo, dual-read/fallback legacy | nuovo account unico e vecchi account funzionanti |
| 4 | Separazione dati profilo | dati comuni, location Owner e area/location Assistant, backfill e compatibilità | dati personali, ricerca e mappe invariati sui profili esistenti |
| 5 | Reputazione contestuale | punteggio ed eventi per capability, backfill e query pubbliche | ranking esistente invariato; eventi Owner e Assistant separati |
| 6 | Discovery dual-role | policy capability centralizzate, ricerca, profilo pubblico, preferiti e divieto self-favorite | stesso account può agire da Owner e risultare Assistant senza commistioni |
| 7 | Prenotazioni a doppia prospettiva | `perspective=owner|assistant`, azioni autorizzate per lato, divieto self-booking, notifiche e recensioni contestuali | richieste inviate/ricevute visibili e azionabili correttamente |
| 8 | Autenticazione nella home | form registrazione unico condiviso nella hero, uscita esplicita da login/registrazione, stato URL, `/register` alias, email/social/mobile | verifica ritorno alla hero, desktop/mobile e flussi email/Google/Apple |
| 9 | Onboarding e switch Assistant | “Diventa Pet Assistant”, draft salvabile, checklist server-side, activation gate, switch UI non autorizzativo | bozza non pubblica, attivazione corretta, Owner sempre disponibile |
| 10 | Consolidamento | CMS, seed/export/snapshot, cancellazione profilo vs account, rimozione fallback/vecchio ruolo dopo osservazione, test end-to-end | collaudo completo e approvazione prima della rimozione legacy |

Regole di esecuzione:

- uno step deve essere completato, testato e documentato prima del successivo;
- ogni step produce un commit/logicamente isolabile e una voce nel changelog;
- le modifiche DB sono additive fino allo step finale; nessuna colonna legacy viene rimossa anticipatamente;
- il backfill viene provato su una copia del database prima dell'ambiente reale;
- ogni gate include test automatici, controlli DB e una checklist manuale breve;
- una mancata approvazione riapre lo stesso step: non si procede accumulando difetti;
- gli step 0–3, 4–7 e 8–10 possono essere lavorati come macro-fasi tecniche, ma i gate restano separati;
- la rimozione del ruolo esclusivo è avvenuta nello STEP 10 dopo backup, restore, prova su clone e verifica dello schema ricostruito da zero; i cookie identità applicativi, essendo insicuri, non sono creati né letti.

## 19. Convenzioni per modifiche future

- Le API devono restituire coerentemente `{ok,data?,message?,errors?}`.
- La validazione deve avvenire server-side anche se duplicata nel client.
- L'identità utente deve provenire dalla sessione autenticata, mai dal payload.
- Le autorizzazioni devono usare policy/guard centrali.
- Ogni mutazione complessa deve essere transazionale e idempotente quando ripetibile dal browser.
- I prezzi devono essere ricalcolati dal server.
- File privati mai esposti tramite route pubblica.
- Nuovi stati di dominio devono essere enumerati qui e testati nelle transizioni.
- Nuove query devono avere indice coerente e piano di backfill.
- Le cancellazioni devono considerare storico, audit, file e requisiti legali; non affidarsi a cascade implicite non presenti.
- Evitare di aggiungere logica a componenti/controller già monolitici: preferire servizi e componenti focalizzati.

## 20. Registro delle modifiche architetturali

| Data | Area | Modifica | File/schema coinvolti | Compatibilità/migrazione | Verifica |
| --- | --- | --- | --- | --- | --- |
| 2026-11-09 | Documentazione | Creazione dell'inventario architetturale completo e registrazione della decisione target multi-profilo | `ARCHITECTURE.md`; ricognizione di frontend, backend, route e `migration.txt` | Nessuna modifica runtime o DB | Revisione statica del workspace |
| 2026-11-09 | UX autenticazione | Registrata la proposta di portare la registrazione neutra nella hero e mantenere `/register` come alias compatibile | `ARCHITECTURE.md`, futura `HomePage`/route registrazione | Decisione documentale; implementazione non ancora eseguita | Verifica visuale di `/` e `/register`, confronto con il pannello login esistente |
| 2026-11-09 | Piano multi-profilo | Suddivisione della migrazione in undici milestone (0–10) con gate manuale “OK”, compatibilità progressiva e rimozione legacy finale | `ARCHITECTURE.md`; futuro intervento trasversale su DB/backend/frontend | Decisione documentale; nessuna modifica runtime o DB | Revisione degli impatti e definizione dei criteri di avanzamento |
| 2026-11-09 | STEP 0 multi-profilo | Acquisita baseline Git/test/schema/dati, verificato restore del backup privato e aggiunto feature flag disattivato | `docs/baselines/changeaccount-step0.md`, `php/config/features.php`, `php/.env.example`, `ARCHITECTURE.md` | Nessuna modifica DB o comportamento; dump privato ignorato da Git; rollback documentato | 15 test/71 assertion, lint, build, restore isolato 43 tabelle/41 utenti |
| 2026-11-09 | Requisito UX autenticazione | Esteso il disegno della hero: login e registrazione devono entrambi offrire “Torna alla home”, ripristino CTA/focus/URL e pulizia password | `ARCHITECTURE.md`; futura `HomePage` e componenti auth condivisi | Requisito documentato per STEP 8; nessuna modifica runtime | Verificata l'assenza del comando nel pannello login attuale |
| 2026-11-09 | STEP 1 identità e sessione | Identità resa esclusivamente server-side, aggiunti resolver/guardie utente e admin, eliminate route duplicate, riattivato CSRF e centralizzato l'invio token nel frontend/CMS | `PortalSession`, `AdminSession`, middleware, controller, `routes/api.php`, helper auth frontend e test; nessuna tabella modificata | Cookie applicativi ID/ruolo non più emessi e cancellati sulle risposte auth; chiave sessione ID conservata; nessuna migrazione o backfill DB | 18 test/76 assertion, lint PHP, route list e build frontend; aggiunti test cookie forgiato, guardie CMS e CSRF 419 |
| 2026-11-09 | STEP 1 security hardening | Corretti Apple JWT senza firma e fallback social per email; aggiunti nonce/state Apple, limiter, header HTTP, blocco email injection, session rotation, CMS fail-closed, test bypass HEAD e aggiornamenti dipendenze compatibili | auth/model, route, middleware sicurezza, Composer/npm lock, `docs/security/changeaccount-step1-security.md`; nessuna tabella modificata | Conferma email ora richiede login successivo; social login richiede provider+subject; nessuna migrazione DB | 28 test/172 assertion; audit runtime npm pulito; advisory Symfony risolti; rischi Laravel/reset documentati |
| 2026-11-09 | Correzione OAuth profili | Caricati gli SDK Google/Apple nelle pagine profilo, aggiunto loader Google resiliente e collegamento just-in-time sicuro degli account social legacy con email attestata dal provider | HTML profili, `googleOAuth.ts`, `AccountChangeModal`, `AuthController`, `UserAccount`, test social | Nessun dato migrato in massa; il collegamento viene creato soltanto dopo prova OAuth valida | 30 test/176 assertion, lint/build e prova reale “Passa a Google” su Pet Assistant completata; quattro test dedicati a provider/subject ed email verificata/non verificata |
| 2026-11-09 | Gate STEP 1 | Milestone identità, sessione e hardening approvata dall'utente con “OK STEP 1” | Intero changeset STEP 1 sul branch `changeaccount` | Pronto per commit isolato; nessuna migrazione DB | Gate manuale completato dopo verifica Google Pet Assistant |
| 2026-11-10 | Backup pre-STEP 0 | Creato un punto di recupero immutabile per migration e database precedenti allo STEP 0 | tag `db-pre-step0-20261109`, `php/migration/backups/pre-step0-20261109.md`, dump privato già acquisito | Nessuna modifica al database operativo; dump con dati personali non versionato | Checksum riconfermato; secondo restore isolato riuscito con 43 tabelle, 41 utenti e 2 prenotazioni |
| 2026-11-10 | STEP 2 capability | Aggiunti schema capability, backfill idempotente e dual-write delle creazioni account legacy | `user_capabilities`, `UserCapability`, `UserAccount`, migration/seed/export/demo, `docs/migrations/changeaccount-step2-capabilities.md` | `users.role` conservato e ancora letto; ogni account Owner, Assistant legacy con entrambe le capability; backup privato prima dell'applicazione | 34 test/183 assertion, lint/build; restore e ricostruzione da zero; dati legacy invariati; 81 capability e 0 errori di mapping; smoke profili/login Assistant riuscito |
| 2026-11-10 | Gate STEP 2 | Milestone schema capability e backfill approvata dall'utente con “OK STEP 2” | Intero changeset STEP 2 sul branch `changeaccount` | Database locale migrato; `users.role` e compatibilità legacy mantenuti | Gate manuale completato dopo verifica utente |
| 2026-11-10 | STEP 3 account neutro | Reso opzionale il ruolo in registrazione, esteso il contratto utente con capability/modalità, aggiunto dual-read legacy e impedita la mutazione del ruolo negli upsert social esistenti | `AuthController`, `UserAccount`, `UserCapability`, test compatibilità, `docs/migrations/changeaccount-step3-neutral-account.md` | Nessuna modifica DB; vecchi payload e link email restano validi; `role` ancora restituito ai client legacy | 43 test/223 assertion; registrazioni neutre email/Google/Apple mock, firme email doppie, fail-closed senza capability attive e smoke `/auth/me` Assistant |
| 2026-11-10 | Gate STEP 3 | Milestone account neutro e compatibilità backend approvata dall'utente con “OK STEP 3” | Intero changeset STEP 3 sul branch `changeaccount` | Nessuna modifica DB; contratto legacy mantenuto | Gate manuale completato dopo verifica utente |
| 2026-11-10 | STEP 4 profili separati | Separati dati comuni, residenza Owner e area operativa Assistant con lettura nuova, fallback e dual-write legacy | `account_profile`, `owner_profile`, `assistant_profile`, `ProfileData`, profili/ricerca/pubblico, seed/export/demo, `docs/migrations/changeaccount-step4-profile-separation.md` | Backfill additivo 41/1/40; `personaldata` invariata e mantenuta come mirror; backup privato prima dell'applicazione | 48 test/252 assertion, lint/build; restore pre-STEP 0 e rerun idempotente; rebuild da zero; zero mismatch/orfani; smoke login/profilo/ricerca/pubblico riuscito |
| 2026-11-10 | Gate STEP 4 | Milestone separazione dati profilo approvata dall'utente con “OK STEP 4” | Intero changeset STEP 4 sul branch `changeaccount` | Database locale migrato; profili legacy conservati tramite mirror e fallback | Gate manuale completato dopo verifica utente |
| 2026-11-10 | STEP 5 reputazione contestuale | Separati score ed eventi Owner/Assistant; ranking pubblico e booking leggono la capability corretta | `profile_reputation`, `reputation_event.subject_capability`, `ProfileReputation`, `Booking`, ricerca/pubblico, seed/export/demo, `docs/migrations/changeaccount-step5-contextual-reputation.md` | Backfill additivo 81 righe; ranking storici invariati; `user_reputation` mantenuta come mirror selettivo; backup privato prima dell'applicazione | 53 test/281 assertion, lint/build; restore pre-STEP 0 e rerun idempotente; rebuild e seed PHP; zero mismatch/orfani; smoke API pubblico/ricerca riuscito |
| 2026-11-10 | Gate STEP 5 | Milestone reputazione contestuale approvata dall'utente con “OK STEP 5” | Intero changeset STEP 5 sul branch `changeaccount` | Database locale migrato; ranking legacy preservati tramite mirror selettivo | Gate manuale completato dopo verifica utente |
| 2026-11-10 | STEP 6 discovery dual-role | Centralizzate le policy capability di discovery; ricerca, profilo pubblico e preferiti non dipendono più dal ruolo esclusivo; vietato il self-favorite | `UserCapability`, `RequireActiveCapability`, ricerca/pubblico, route e frontend discovery, `pet_assistant_favorite`, `docs/migrations/changeaccount-step6-dual-role-discovery.md` | Fallback legacy solo per account senza righe capability; booking e switch UI rinviati; cleanup idempotente di eventuali self-favorite e check DB | 58 test/304 assertion; rebuild 41 utenti/81 capability; prova MySQL ruolo Owner + Assistant attivo/sospeso; smoke HTTP preferiti e 422 self-favorite; lint/build |
| 2026-11-16 | Gate STEP 6 | Milestone discovery dual-role e policy capability approvata dall'utente con “OK STEP 6” | Intero changeset STEP 6 sul branch `changeaccount` | Database locale migrato; fallback legacy e confini STEP 7/9 mantenuti | Gate manuale completato dopo verifica utente |
| 2026-11-16 | STEP 7 booking dual-role | Aggiunta prospettiva esplicita a inbox e azioni, autorizzazione per capability+lato, conferme modali Owner/Assistant, divieto self-booking, recensioni e notifiche contestuali; uniformati componente località, font Nunito, favicon e metadati visuali dei due profili | `Booking`, `BookingController`, route, `BookingsSection`, `ProfileFieldMeta`, HTML e UI profili/booking, `booking`, `booking_review`, `docs/migrations/changeaccount-step7-dual-perspective-booking.md` | Due colonne recensione con backfill; tre check; fallback capability legacy solo senza righe; switch UI globale rinviato allo STEP 9 | 60 test/324 assertion, build; audit browser di 66 classi condivise; restore pre-STEP 0 e migration idempotente; smoke HTTP Owner/Assistant e self-profile |
| 2026-11-16 | Gate STEP 7 | Milestone booking dual-role, conferme azioni e uniformità visuale dei profili approvata dall'utente con “OK STEP 7” | Intero changeset STEP 7 sul branch `changeaccount` | Database locale migrato; prospettiva esplicita e fallback capability legacy mantenuti | Gate manuale completato dopo verifica utente |
| 2026-11-16 | STEP 8 autenticazione nella home | Sostituite le viste login/registrazione nella hero con stato URL esclusivo, uscita esplicita, pulizia password e focus; registrazione neutra email/Google/Apple; `/register` trasformato in alias e rimossa la vecchia entry a due ruoli | `HomePage`, `home.css`, `vite.config.ts`, route e test; rimossi `RegisterPage`, `register.html`, `register.tsx`, `register.css`; `docs/migrations/changeaccount-step8-home-auth.md` | Nessuna modifica DB; endpoint `role?` ancora compatibili; bookmark `/register` preservati via redirect `302` | 61 test/326 asserzioni, build e lint; smoke browser desktop/mobile, alias, back/forward, focus e pulizia password |
| 2026-11-16 | Audit globale e gate STEP 8 | Verificati cumulativamente STEP 0–8; aggiornati Laravel nella major 11 e toolchain npm; fissata piattaforma Composer al PHP 8.3.30 di MAMP; censiti i rischi residui | `composer.json`, `composer.lock`, `package-lock.json`, documenti STEP 1/7/8 e `docs/audits/changeaccount-step8-global-audit.md` | Nessuna modifica DB; backup e vincoli ricontrollati; upgrade Laravel 12 rinviato a milestone dedicata | Suite 61/326, build e lint; audit npm pulito; audit Composer senza criticità TokenGuard; smoke HTTP/browser desktop e mobile; gate utente `OK STEP 8` |
| 2026-11-16 | STEP 9 onboarding e switch | Aggiunti bozza Assistant privata, checklist server-side informativa, gate di pubblicazione su Alias/Città salvati, aggiornamento automatico, modalità di sessione, CTA e switch condiviso nei profili | `AssistantOnboarding`, controller/middleware, `PortalSession`, `HomePage`, `ProfileModeSwitcher`, profili, route, test e `docs/migrations/changeaccount-step9-assistant-onboarding.md` | Nessuna nuova tabella; usa stato/current_step/timestamp di `user_capabilities`; Owner resta attivo; backup privato pre-step acquisito | Controlli manuali completati; audit globale 66 test/380 asserzioni, lint/build, npm e Composer audit puliti, invarianti DB pulite; gate esplicito in attesa |
| 2026-11-16 | Catalogo e profilo pubblico Assistant | Aggiunta la qualifica `Operatore Olistico`; chiarito che qualifiche e testi pubblici sono informativi e migliorata la spaziatura/descrizione dei campi | `operatortitle`, `Profile`, profilo Assistant, `migration.txt`, seed configurazione, README e architettura | Inserimento idempotente `operatortitle.id=6`; nessuna modifica schema e nessun impatto sui record booking | Database locale verificato; 66 test/380 asserzioni, lint e build |
| 2026-11-16 | Privacy mappa Assistant | Spostato il consenso alla posizione esatta accanto alla mappa e collegato il flag al salvataggio Dati personali senza sovrascrivere gli altri contenuti pubblici | profilo Assistant, `ProfileController`, `Profile`, `operator_public_profile.publish_exact_location`, test separazione profili | Nessuna modifica schema o backfill; aggiornamento mirato della sola colonna consenso | Test dedicato e suite 66/380, lint/build, diff check |
| 2026-11-16 | Upgrade sicurezza Laravel 12 | Aggiornato Laravel 11.57.1 a 12.72.0 e chiusi i cinque advisory Composer residui | `composer.json`, `composer.lock`, README, documentazione sicurezza/audit | Nessuna modifica DB; PHP di piattaforma resta 8.3.30; aggiunto solo `symfony/polyfill-php84` | Composer audit pulito, 66 test/380 asserzioni, 107 route, smoke HTTP, lint/build/npm audit e invarianti DB |
| 2026-11-16 | Gate STEP 9 | Milestone onboarding, switch multi-profilo, rifiniture profilo Assistant e upgrade Laravel 12 approvati dall'utente | Intero changeset STEP 9 sul branch `changeaccount` | Nessuna nuova tabella; catalogo qualifica additivo; backup pre-step integro | Controlli manuali completati, audit globale pulito e gate utente `OK STEP 9` |
| 2026-11-16 | STEP 10 cutover definitivo | Rimosso il ruolo esclusivo e resi autorevoli capability, profili contestuali e reputazioni per capability; aggiornati auth, discovery, booking, CMS demo, seed/export e schema cumulativo | `users`, `user_capabilities`, profili, `profile_reputation`, modelli/controller/frontend/test, `migration.txt`, `step10_finalize_multi_profile.sql`, seed ed export, `docs/migrations/changeaccount-step10-final-cutover.md` | Eliminati `users.role`, `personaldata`, `user_reputation`; backup privato verificato; rollback solo tramite restore completo | Cutover provato su clone 42/83/83 e applicato al DB locale; rebuild vuoto 46 tabelle; seed 41 account/40 Assistant/81 reputazioni; 66 test/362 asserzioni, 110 route, lint/build, audit Composer/npm e smoke HTTP puliti |
| 2026-11-16 | Gate STEP 10 | Approvato il consolidamento definitivo multi-profilo e la regola CTA home coerente con lo switch Owner/Assistant | Intero changeset STEP 10 sul branch `changeaccount` | Database locale sullo schema finale; rollback disponibile dal backup privato verificato | Gate utente `OK STEP 10`; migrazione multi-profilo completata |
| 2026-11-16 | Pulizia post-cutover | Rimossi il feature flag non consumato, la compatibilità runtime del cookie ruolo, il fallback a uno snapshot demo assente e sei dump intermedi; mantenuti migration di upgrade, audit, backup pre-STEP 0 e backup pre-cutover finale | `php/.env.example`, `PortalSession`, `AuthController`, `DemoData`, `php/config/features.php`, storage backup privato e documentazione | Nessuna modifica DB; i dump intermedi sono stati spostati nel Cestino e restano recuperabili fino al suo svuotamento | Ricerca globale dei residui, suite backend, lint e build frontend |
| 2026-11-17 | Audit conclusivo multi-profilo | Corretto il pacchetto Netsons: rimosso il riferimento allo snapshot eliminato e inclusi schema finale, cutover, seed correnti e storage demo richiesti dal runtime; riallineata la descrizione dell’API ricerca e separata la toolchain frontend dalle dipendenze pubblicate | `deploy/build-netsons-package.sh`, `html/package.json`, lockfile, `ARCHITECTURE.md`, documentazione sicurezza e asset `php/migration` | Nessuna modifica DB; il pacchetto contiene sia gli asset runtime correnti sia gli strumenti necessari ad aggiornare o ricostruire lo schema | Pacchetto end-to-end, dump senza schema legacy, suite backend, lint/build, audit Composer e audit npm runtime puliti; advisory dev-only `picomatch` censita in attesa di fix upstream |
| 2026-11-21 | Comandi CMS manutenzione dati | Allineati i tre comandi allo schema multi-profilo: svuotamento totale, ripristino sistema previa pulizia completa e ripristino demo limitato a dati/storage operativi; corretti testi e contatori CMS | `DemoData`, `DemoDataMaintenanceTest`, `cmsadminsite.html`, snapshot e documentazione migration | Nessuna modifica schema; partizione esplicita 9 tabelle sistema + 37 operative; backup DB privati esclusi dalla pulizia storage | Test statici di copertura schema/snapshot, collaudo MySQL isolato dei tre comandi, suite backend, lint e build frontend |
| 2026-11-21 | Calendari dataset demo 2027 | Estese disponibilità e fasce dei 40 profili Assistant dal 21 novembre 2026 al 31 dicembre 2027; selezione basata su capability attiva e copertura obbligatoria dell'ultima data | generatori calendario, `seed_demo_data.sql`, riepilogo `DemoData`, CMS e documentazione | Nessuna modifica schema; snapshot rigenerato in database isolato senza alterare il DB di lavoro | Snapshot base: 11.210 giornate, 20.866 fasce e 39.094 associazioni servizio; ripristino completo con estensione olistica: 11.235 giornate in 2,261 s; 40/40 Assistant attivi il 31/12/2027; test di regressione dedicato |
| 2026-11-21 | Sesso pet nelle prenotazioni | Esposto il sesso già presente nell'anagrafica del pet all'interno del DTO prenotazione e delle card riservate a Pet Owner e Pet Assistant, con label italiane e fallback esplicito | `Booking`, `BookingsSection`, test del flusso prenotazioni | Nessuna modifica DB: riutilizzata la colonna `ownerpet.sex` già esistente e validata | Test di regressione sul mapping `petSex`, suite backend, lint e build frontend |
| 2026-11-21 | Tassonomia gruppi pet e accettazione esplicita | Sostituite le razze puntuali con 40 gruppi pet per cani, gatti, conigli, furetti, piccoli mammiferi, uccelli, rettili, anfibi, pesci, invertebrati, equidi e altri pet; separati i gruppi accettati e non accettati; aggiunto il tipo `Malato` | profili Owner/Assistant, ricerca, dettaglio pubblico, migration, snapshot sistema/demo e test | Aggiunte `petbreed.category` e `petbreeddata.acceptance`; nomi fisici legacy mantenuti per upgrade non distruttivo; conversione automatica delle associazioni esistenti | Fonti tassonomiche: FCI, FIFe e classificazione UE dei companion animals; migration MySQL isolata, 40 gruppi, 131 preferenze accettate, 120 rifiutate, 10 profili demo `Malato` |
| 2026-11-21 | Filtri razza e categoria nei gruppi pet | Rimossi dai nomi visibili i prefissi numerici `Gruppo N FCI`; aggiunti filtri testuali per razza e tendine per categoria animale, indipendenti nelle liste accettati e non accettati | profilo Assistant, catalogo runtime, migration e snapshot sistema | Nessuna variazione strutturale DB; aggiornati i nomi dei gruppi 101–111; le razze comuni restano parole chiave applicative e non nuovi record | Suite backend, lint/build e verifica visuale delle due coppie di filtri |

### Modello per nuove righe

```text
| YYYY-MM-DD | area | descrizione concreta | file e tabelle | backfill/rollback/compatibilità | test e comandi eseguiti |
```

