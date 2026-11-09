# Architettura e registro tecnico di Coccole Bestiali

> Documento vivente e fonte di orientamento tecnico del portale.
>
> Ultima ricognizione completa: **9 novembre 2026**.
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

Coccole Bestiali è un marketplace per servizi dedicati agli animali domestici. Nel paradigma attuale esistono due tipi di utenza mutuamente esclusivi:

- **Pet Owner**: registra uno o più pet, cerca Pet Assistant, salva preferiti, invia prenotazioni, gestisce richieste e recensioni.
- **Pet Assistant**: configura identità professionale, servizi, prezzi, caratteristiche, galleria, calendario e gestisce le richieste ricevute.

Un CMS amministrativo gestisce messaggi, errori, cataloghi, servizi, policy e dataset demo.

La direzione architetturale approvata per la futura evoluzione è sostituire il ruolo esclusivo con un account globale capace di possedere contemporaneamente i profili Owner e Assistant. La proposta è descritta nella sezione **Architettura target multi-profilo**; non rappresenta ancora lo schema implementato.

## 3. Stack tecnologico

| Livello | Tecnologia | Versione/vincolo rilevato |
| --- | --- | --- |
| Backend | PHP | `^8.2` |
| Framework | Laravel | `^11.0` nel `composer.json` |
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

Nota: il README radice parla di Laravel 13, ma il manifest effettivo richiede Laravel 11. Il manifest è la fonte tecnica prevalente finché la documentazione non viene riallineata.

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

Laravel carica `php/routes/api.php` come file di route `web` in `php/bootstrap/app.php`. Di conseguenza lo stesso file contiene sia pagine sia API. Una parte delle API è definita prima del gruppo middleware e una seconda parte è nel gruppo `middleware('api')` con CSRF esplicitamente disabilitato.

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
| `/register` | `register.html` | `tsx/register.tsx` | `RegisterPage.tsx` |
| `/profile/petowner` | `profile-petowner.html` | `tsx/profile-petowner.tsx` | `PetOwnerProfilePage.tsx` |
| `/profile/petassistant` | `profile-petassistant.html` | `tsx/profile-petassistant.tsx` | `ProfilePlaceholderPage.tsx` |
| `/search` | `search.html` | `tsx/search.tsx` | `PetAssistantSearchPage.tsx` |
| `/pet-assistants/{id}` | `pet-assistant-detail.html` | `tsx/pet-assistant-detail.tsx` | `PublicPetAssistantPage.tsx` |
| demo | `demo.html` | `tsx/demo.tsx` | `DemoPage.tsx` con Inertia |
| template | `template_empty.html` | `tsx/template_empty.tsx` | `TemplateEmptyPage.tsx` |
| `/cmsadminsite` | `cmsadminsite.html` | script inline/jQuery | CMS amministrativo |

### 6.2 Responsabilità delle pagine

- `HomePage`: stato sessione, login email/Google/Apple, password dimenticata/temporanea, logout, modale contatti e call to action. Il contenuto autenticato dipende da `currentUser.role`.
- `RegisterPage`: due card di registrazione alternative, una Owner e una Assistant; email/password, Google e Apple.
- `PetOwnerProfilePage`: dati personali, coordinate, credenziali, pet, preferiti, prenotazioni e cancellazione account.
- `ProfilePlaceholderPage`: profilo Pet Assistant; dati personali, dati operatore, servizi, prezzi, galleria, geolocalizzazione, calendario, prenotazioni e account.
- `PetAssistantSearchPage`: filtri per date, servizi, caratteristiche, foto, preferiti e ranking; salva lo stato utile alla navigazione.
- `PublicPetAssistantPage`: profilo pubblico, statistiche risposta, recensioni, galleria, mappa, servizi, preferito e form di prenotazione multipla.
- `cmsadminsite.html`: login amministrativo e pannelli per messaggi, errori, cataloghi, servizi, policy e dati demo.

### 6.3 Componenti condivisi principali

| Componente | Responsabilità |
| --- | --- |
| `BookingsSection` | elenco e azioni prenotazioni; riceve `role` per presentare la prospettiva Owner/Assistant |
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
| `BookingController` | `index(Request)`; `activeForAssistant(Request)`; `store(Request)`; `storeBatch(Request)`; accept/decline/cancel; alternative; riprogrammazione; recensione; modalità conferma; token email |
| `MessageController` | invio contatto; elenco/cancellazione/riposta messaggi CMS |
| `AdminController` | sessione admin; cataloghi; servizi; policy; errori; clear/restore/seed demo |

I controller validano l'input, traducono eccezioni in JSON/codici HTTP e delegano la logica ai modelli. Alcuni controller risolvono l'utente in modo indipendente; questa duplicazione è debito tecnico da centralizzare.

### 7.2 Modelli e servizi di dominio

| Classe | Funzioni/parametri caratterizzanti |
| --- | --- |
| `UserAccount` | autenticazione email; `registerEmailUser(role,email,password)`; `upsertSocialUser(provider,sub,role,email,...)`; login social; cambio provider; lookup utente; verifica email; password temporanea; cancellazione completa account/file |
| `Profile` | `getPersonalProfile(userId)`; opzioni; CRUD pet; gallery/documenti; `getOperatorProfile(userId)`; `savePersonalProfile(userId,payload)`; credenziali; `saveOperatorProfile(userId,payload)`; calendario |
| `PetAssistantSearch` | `getOptions(userId=0)`; `search(startDate,endDate,serviceIds,petId,userId,duration,sortBy,onlyWithPhoto,optionFilters,onlyFavorites,showFavoriteStatus)`; disponibilità; distanza; compatibilità pet; servizi |
| `PublicPetAssistant` | query base profili; dettaglio; preferiti; statistiche risposta; recensioni pubblicate; etichette catalogo |
| `Booking` | riconciliazione; creazione singola/batch; listato; accept/decline/cancel; riprogrammazione; review; confirmation mode; token; controllo slot/prezzi/sovrapposizioni; reputazione; email ciclo vita |
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

- `GET /`, `/register`, `/profile/petowner`, `/profile/petassistant`, `/search`: servono entry HTML compilati.
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
| `GET /api/auth/me` | sessione/cookie | utente corrente |
| `POST /api/auth/register/email` | `role,email,password` | crea account non verificato e invia email |
| `POST /api/auth/register/google` | `role,idToken/accessToken` | upsert account social e sessione |
| `POST /api/auth/register/apple` | `role,identityToken,user?` | upsert account social e sessione |
| `POST /api/auth/login/email` | `email,password` | sessione e utente |
| `POST /api/auth/login/google` | token | sessione e utente esistente |
| `POST /api/auth/login/apple` | token | sessione e utente esistente |
| `GET /api/auth/verify-email` | `email,role,expires,signature` | verifica email, sessione e redirect profilo |
| `POST /api/auth/password/forgot` | `email` | password temporanea inviata senza enumerazione esplicita |
| `POST /api/auth/password/temporary` | password e conferma | sostituzione password temporanea |
| `POST /api/auth/account/{email|google|apple}` | credenziali/token | cambia metodo di accesso dell'account corrente |
| `POST /api/auth/logout` | sessione | invalida sessione/cookie |
| `DELETE /api/auth/account` | sessione | elimina account, dominio e file associati |
| `POST /api/auth/frontend-error` | `context,message,details?` | registra diagnostica |

Gli endpoint `apple/mock` replicano registrazione, login e cambio account se `APPLE_MOCK_AUTH` è abilitato.

### 8.3 Profili e pet

- `GET|POST /api/profile/petowner/personal`: profilo personale Owner.
- `POST /api/profile/petowner/password`: cambio password Owner.
- `GET /api/profile/petowner/pets/options`: razze/tipi/taglie e metadati documento.
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

- `GET /api/search/pet-assistants/options`: servizi, pet autenticato, ruolo e policy.
- `POST /api/search/pet-assistants`: date, servizi, durata, pet, ordinamento, foto, feature e preferiti.
- `GET /api/pet-assistants/{assistantId}`: profilo pubblico completo.
- `GET /api/pet-assistants/{assistantId}/availability?startDate=&endDate=`: slot del profilo.
- `GET /api/pet-assistant-favorites`: preferiti dell'Owner corrente.
- `PUT /api/pet-assistants/{assistantId}/favorite`: `{favorite:boolean}`.

### 8.5 Prenotazioni

- `GET /api/bookings`: prenotazioni dell'utente nella prospettiva determinata dal ruolo corrente.
- `GET /api/bookings/active-for-assistant`: richieste attive Assistant, richiede sessione server.
- `POST /api/bookings`: prenotazione singola storica.
- `POST /api/bookings/batch`: batch idempotente con `requestKey` UUID e uno o più servizi.
- `POST /api/bookings/confirmation-mode`: `manual|automatic`.
- `POST /api/bookings/{id}/accept|decline|cancel`.
- `GET /api/bookings/{id}/alternatives`.
- `POST /api/bookings/{id}/reschedule` e `/reschedule/respond`.
- `POST /api/bookings/{id}/review`: sentiment, testo e consenso pubblicazione.
- `GET|POST /api/bookings/action/{token}`: visualizzazione/consumo azione email monouso.

Payload batch caratterizzante:

```json
{
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

La registrazione email richiede almeno 10 caratteri, maiuscola, minuscola, numero, simbolo e nessuno spazio. La conferma email usa una firma HMAC con scadenza. La password dimenticata genera una password temporanea e imposta `password_reset_required`.

### 9.2 Sessione corrente

Il backend salva in sessione:

- `cb_portal_user_id`;
- `cb_portal_user_role`.

Scrive inoltre cookie omonimi per 30 giorni. Il resolver corrente accetta l'ID anche dal cookie o dall'header raw se la sessione non è disponibile. I cookie applicativi sono creati con `secure=false` e `httpOnly=false`.

Questa è una criticità: un identificativo controllabile dal client non deve essere una sorgente attendibile dell'identità. L'architettura target deve usare soltanto la sessione autenticata e policy/capability server-side. Le route mutative devono inoltre adottare una protezione CSRF coerente.

### 9.3 Amministrazione

Il CMS usa la chiave di sessione `cb_admin_authenticated`. Le credenziali provengono da `CMS_ADMIN_USERNAME` e `CMS_ADMIN_PASSWORD`; i fallback presenti nel codice sono adatti soltanto allo sviluppo e devono essere sovrascritti in produzione.

## 10. Modello di dominio e regole

### 10.1 Ruoli attuali

`users.role` vale `pet_owner` o `pet_assistant`. I controlli sono distribuiti tra controller, modelli e frontend. Non esiste ancora una policy centralizzata.

### 10.2 Pet Owner

- Un Owner può possedere fino a 20 pet nel payload corrente.
- Ogni pet ha anagrafica, taglia, razze, caratteristiche, gallery e documenti.
- Una sola foto gallery può essere principale per la visualizzazione.
- I documenti sono privati e scaricabili soltanto dal proprietario.
- I preferiti sono coppie Owner/Assistant.

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
- Attualmente la reputazione è unica per account: è un limite per il futuro multi-profilo.

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

Non risultano foreign key SQL esplicite: l'integrità referenziale è affidata a indici, vincoli univoci e codice applicativo. Ogni nuova relazione deve valutare consapevolmente se introdurre FK oppure mantenere l'approccio attuale documentandone il motivo.

### 11.2 Catalogo completo delle tabelle applicative

#### Account, profili e diagnostica

| Tabella | Chiavi/campi principali | Relazioni e funzione |
| --- | --- | --- |
| `users` | `id`, `role`, `name`, `email` unique, verifiche, password, avatar, timestamp Unix | account globale attuale e ruolo esclusivo |
| `social_accounts` | provider+sub unique, `user_id`, email/claims provider | identità Google/Apple |
| `personaldata` | `user_id` unique, nome, foto, età, città, telefono, indirizzo, coordinate, raggio | dati comuni e location; oggi mescola Owner e Assistant |
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
| `petbreed` / `petbreeddata` | catalogo razze e razze gestite dall'Assistant |
| `pettype` / `pettypedata` | catalogo caratteristiche e caratteristiche accettate |
| `housefeature` / `housefeaturedata` | catalogo e caratteristiche abitazione |
| `operatorgallery` | foto, caption e ordine gallery Assistant |

Le tabelle relazione usano vincoli univoci compositi per impedire duplicati.

#### Pet Owner

| Tabella | Campi principali | Relazioni |
| --- | --- | --- |
| `ownerpet` | `user_id`, nome, sesso, data nascita, microchip, note, taglia, ordine | molti pet per utente |
| `ownerpetbreeddata` | `pet_id`,`petbreed_id` unique | razze del pet |
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
| `booking` | numero unique, Owner, Assistant, pet, servizio, slot, data/orari, durata, prezzi, stato, deadline, cancellazione, batch, prima risposta |
| `booking_batch` | Owner, request UUID e hash; unique Owner-request |
| `booking_feature_preference` | unique booking-feature e nome snapshot |
| `booking_reschedule` | proposta, proponente, nuovo slot/prezzo, stato precedente e stato proposta |
| `booking_review` | booking, reviewer, reviewed, sentiment, commento, delta, consenso pubblicazione; unique booking-reviewer |
| `user_reputation` | PK `user_id`, score |
| `reputation_event` | utente, booking, attore, tipo, delta, score risultante e nota |
| `booking_action_token` | token hash unique, booking, utente, azione, scadenza e consumo |
| `pet_assistant_favorite` | PK composita Owner-Assistant |

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
├── personaldata
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
├── user_reputation
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
- `seed_demo_data.sql`: un Owner, Rex, 40 Assistant e dati operativi.
- `seed_demo_holistic.sql`: estensione operatori olistici e disponibilità.
- `seed_pet_assistants.php`: rigenerazione distruttiva dei 40 profili locali.
- `seed_pet_assistant_calendars.php`: rigenera soltanto calendari.
- `export_current_profiles.php`: esporta snapshot e file referenziati.
- `demo_storage/manifest.json`: inventario asset demo.

Le operazioni CMS `clear-all`, `restore-system` e `seed` sono distruttive o materialmente mutative e devono restare protette dalla sessione admin.

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

1. **Ruolo esclusivo**: `users.role` impedisce la coesistenza Owner/Assistant.
2. **Identità da cookie**: l'ID applicativo è accettato anche da cookie modificabile dal client.
3. **CSRF**: il gruppo API principale disabilita esplicitamente `VerifyCsrfToken`.
4. **Resolver duplicati**: più controller implementano autonomamente la risoluzione utente.
5. **Autorizzazioni distribuite**: controlli `where(role=...)` non centralizzati.
6. **Login social**: l'upsert può sovrascrivere il ruolo di un account esistente trovato per email.
7. **Dati personali misti**: `personaldata` combina dati comuni, residenza Owner e area operativa Assistant.
8. **Reputazione unica**: eventi Owner e Assistant convergono nello stesso score.
9. **Schema non versionato**: uno script cumulativo rende meno esplicita la sequenza delle release.
10. **Assenza di FK SQL**: possibili record orfani se un percorso di cancellazione non è completo.
11. **Controller/modelli molto estesi**: `AuthController`, `ProfileController`, `Profile` e `Booking` hanno responsabilità ampie.
12. **CMS monolitico**: HTML/script inline e dipendenze CDN rendono più difficile testing e build riproducibile.
13. **Duplicazione route**: alcuni endpoint sono registrati fuori e dentro il gruppo API; evitare collisioni e divergenze middleware.
14. **Documentazione versioni**: README e manifest non concordano sulla versione Laravel.

## 18. Architettura target multi-profilo

Questa sezione registra la decisione progettuale per superare il ruolo esclusivo. È una specifica target, non ancora implementata.

### 18.1 Principi

Separare:

1. account e credenziali;
2. profilo personale condiviso;
3. capacità operative Owner/Assistant;
4. stato di onboarding e pubblicazione;
5. modalità UI corrente, che non costituisce autorizzazione.

Ogni account può agire come Owner. Il profilo Assistant è opzionale, salvabile in bozza e pubblicabile dopo il completamento dei requisiti.

### 18.2 Schema target indicativo

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

Separazione dati consigliata:

```text
account_profile     nome/foto/telefono/dati comuni
owner_profile       residenza/location Owner
assistant_profile   area operativa/location/raggio e stato pubblicazione
```

La reputazione deve diventare contestuale:

```text
profile_reputation PK (user_id, capability)
reputation_event.subject_capability
```

### 18.3 Onboarding target

- Registrazione neutra “Account Coccole Bestiali”.
- Owner disponibile senza scelta irreversibile; pet richiesto just-in-time alla prenotazione.
- CTA “Diventa Pet Assistant”.
- Wizard salvabile: identità, tipo operatore, dati fiscali, area, esperienza, servizi/prezzi, casa/gallery, calendario, verifiche, riepilogo.
- Profilo ricercabile solo con capability Assistant `active`.
- Switch Owner/Assistant come preferenza di interfaccia.
- Sospensione o disattivazione Assistant non elimina l'account Owner.

### 18.4 Impatti obbligatori

- `/auth/me` dovrà restituire capacità, stati e modalità UI, non un solo ruolo.
- Ricerca e profilo pubblico dovranno filtrare capability Assistant attiva.
- Prenotazioni dovranno accettare `perspective=owner|assistant`.
- Impedire prenotazione, preferito e recensione verso se stessi.
- Separare location e reputazione per contesto.
- Il login social non dovrà mai rimuovere capacità esistenti.
- Distinguere disattivazione profilo dalla cancellazione account.
- Non unire automaticamente eventuali account doppi preesistenti.

### 18.5 Strategia di migrazione

1. Correggere autenticazione/sessione e aggiungere test di caratterizzazione.
2. Aggiungere schema capability in modo additivo.
3. Backfill: tutti Owner attivi; gli Assistant esistenti anche Assistant attivi.
4. Introdurre lettura nuova con fallback temporaneo a `users.role`.
5. Centralizzare le policy di autorizzazione.
6. Adeguare ricerca, profili, booking, reputazione, CMS, seed ed export.
7. Rilasciare il frontend con feature flag.
8. Monitorare e rimuovere infine campo/cookie del vecchio ruolo.

### 18.6 Ingresso alla registrazione target (decisione proposta)

Con la registrazione neutra non sono più necessarie le due card Owner/Assistant della pagina autonoma corrente. Il pattern raccomandato è:

- il click su **Registrati** nella home sostituisce la section `.hero-cta` con un pannello inline “Crea il tuo account”, analogamente al pannello di login già esistente;
- il pannello contiene un solo form email/password e le alternative Google/Apple, senza selezione permanente del ruolo;
- un pulsante esplicito **Torna alla home** ripristina la `.hero-cta` predefinita senza ricaricare la pagina;
- login e registrazione sono viste mutuamente esclusive dello stesso contenitore e condividono componenti, validazione, errori e OAuth;
- lo stato è rappresentato nell'URL, ad esempio `/?auth=register`, affinché refresh, back del browser, deep link e analytics restino corretti;
- `/register` non deve essere eliminata immediatamente: diventa un alias/redirect compatibile verso `/?auth=register`, preservando bookmark e link esterni;
- il form deve essere estratto in un componente condiviso, evitando di mantenere due implementazioni della registrazione;
- su mobile il pannello rimane nel normale flusso verticale e la pagina può scorrere; non usare un modal per il form principale;
- dopo registrazione email si mostra uno stato persistente di conferma email; dopo registrazione social si applica il redirect previsto dal nuovo account globale;
- l'onboarding Pet Assistant resta un flusso successivo e separato, avviato dalla CTA “Diventa Pet Assistant”.

La pagina autonoma va mantenuta soltanto se in futuro la registrazione richiederà contenuti legali, editoriali o step sufficientemente estesi da non essere gestibili nella hero. Nel perimetro attuale una pagina separata aggiungerebbe una transizione senza valore e produrrebbe spazio inutilizzato.

### 18.7 Piano di consegna a milestone (decisione proposta)

La migrazione multi-profilo non deve essere implementata come un unico intervento. Si procede per milestone compatibili e verificabili. Al termine di ogni milestone l'implementazione viene fermata, vengono consegnati risultati automatici e checklist manuale, e la milestone successiva inizia soltanto dopo approvazione esplicita.

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
| 8 | Registrazione nella home | form unico condiviso nella hero, stato URL, ritorno home, `/register` alias, email/social/mobile | verifica visuale desktop/mobile e flussi email/Google/Apple |
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
- la rimozione di `users.role`, dei cookie legacy e della vecchia UI avviene solo dopo un periodo di compatibilità osservato.

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

### Modello per nuove righe

```text
| YYYY-MM-DD | area | descrizione concreta | file e tabelle | backfill/rollback/compatibilità | test e comandi eseguiti |
```

