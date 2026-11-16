# STEP 8 — autenticazione nella home

Data: 16 novembre 2026  
Branch: `changeaccount`  
Stato milestone: **approvata manualmente — OK STEP 8 ricevuto il 16 novembre 2026**.

## Obiettivo

Rimuovere dalla registrazione la scelta esclusiva Pet Owner/Pet Assistant e presentare login e creazione account nello stesso contenitore della home, mantenendo accessibili i vecchi link `/register`.

Lo STEP 8 non introduce ancora lo switch di modalità né l'onboarding Assistant: appartengono allo STEP 9.

## Architettura frontend

`HomePage` gestisce tre viste mutuamente esclusive:

- `default`: call to action della home o contenuto autenticato;
- `login`: pannello “Accedi al tuo profilo”;
- `register`: pannello “Crea il tuo account”.

Lo stato è rappresentato con `?auth=login` e `?auth=register`. Un listener `popstate` sincronizza back e forward del browser. Il vecchio parametro `login=1` con `returnTo` resta leggibile per i link già emessi.

Entrambi i pannelli espongono **Torna alla home**. La chiusura:

1. ripristina la vista predefinita senza ricaricare la pagina;
2. rimuove `auth`, `login` e l'eventuale flag `verified` dall'URL;
3. cancella password e conferma dalla memoria React;
4. riporta il focus al pulsante che ha aperto la vista.

## Registrazione neutra

Il form contiene:

- email;
- password e conferma;
- indicatori dei sei requisiti password;
- Google e Apple.

Nessuna richiesta del nuovo client invia `role`. Il backend assegna il valore tecnico Owner e la capability Owner come stabilito nello STEP 3. Dopo registrazione email il pannello resta aperto e mostra lo stato persistente di conferma; la registrazione social conserva il redirect restituito dal backend.

Login e registrazione condividono configurazione OAuth e client Google. Un riferimento all'intento corrente instrada il callback verso login o registrazione, evitando inizializzazioni concorrenti. I flussi Apple utilizzano lo stesso challenge nonce/state server-side.

## Compatibilità `/register`

`GET /register` restituisce `302` verso `/?auth=register`. Sono stati rimossi:

- `html/src/pages/RegisterPage.tsx`;
- `html/src/html/register.html`;
- `html/src/tsx/register.tsx`;
- `html/src/css/register.css`;
- l'entry `register` dalla configurazione Vite.

In questo modo bookmark e link esterni restano validi, ma non esiste una seconda implementazione che possa divergere o riproporre la scelta del ruolo.

## Database e rollback

Lo STEP 8 non modifica schema o dati e non richiede backup o migration.

Rollback applicativo:

1. ripristinare i sorgenti della pagina registrazione dallo STEP 7;
2. ripristinare l'entry Vite e la route file `/register`;
3. lasciare invariati database ed endpoint di registrazione.

## Verifiche eseguite

- suite backend: **61 test, 326 asserzioni**;
- build TypeScript/Vite senza la vecchia entry `register`;
- test HTTP del redirect `/register` e lint PHP;
- deep link `/?auth=register` aperto direttamente;
- pannelli login e registrazione mutuamente esclusivi;
- back e forward ripristinano la vista coerente con l'URL;
- “Torna alla home” ripristina CTA, URL e focus;
- password login, password registrazione e conferma vengono azzerate;
- `/register` arriva al pannello neutro e non mostra card di ruolo;
- viewport mobile 390×844 senza overflow orizzontale e con form nel flusso verticale.
- audit globale degli STEP 0–8 su route, autorizzazioni, vincoli DB, backup, profili e dipendenze;
- confronto browser dei due profili: 66 classi condivise senza differenze di stile calcolato;
- `npm audit`: 0 vulnerabilità, incluse le dipendenze di sviluppo;
- Laravel aggiornato nella stessa major da 11.51.0 a 11.57.1, rimuovendo l'advisory critico TokenGuard;
- requisiti Composer verificati contro PHP 8.3.30, la versione servita da MAMP;
- `git diff --check` superato.

Il rapporto completo è in `docs/audits/changeaccount-step8-global-audit.md`.

## Gate manuale STEP 8 — approvato

Gate approvato dall'utente il **16 novembre 2026** con `OK STEP 8`, dopo richiesta di collaudo globale degli STEP 0–8.

Verificare:

- dalla home, **Accedi** apre il login e **Torna alla home** ripristina la CTA;
- dalla home, **Registrati** apre un solo form neutro e **Torna alla home** ripristina la CTA;
- refresh, back e forward rispettano `?auth=login|register`;
- `/register` porta a `/?auth=register`;
- password e conferma non ricompaiono dopo la chiusura;
- registrazione email mostra la richiesta di conferma senza selezione ruolo;
- Google e Apple aprono il rispettivo provider sia in login sia in registrazione;
- su mobile non compaiono overflow o modali per il form principale.

La checklist è stata confermata e la milestone può essere consolidata nel commit isolato.
