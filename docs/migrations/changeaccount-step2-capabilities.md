# STEP 2 — Schema capability additivo

Data: 10 novembre 2026

Branch: `changeaccount`

Stato milestone: **approvata manualmente — “OK STEP 2” ricevuto il 10 novembre 2026**.

## Obiettivo

Separare progressivamente l'account globale dalle funzioni Owner e Assistant senza rimuovere o reinterpretare `users.role`. Lo STEP 2 introduce esclusivamente una rappresentazione additiva delle capability; il portale continua a leggere il ruolo legacy fino allo STEP 3.

## Schema introdotto

Tabella `user_capabilities`:

| Campo | Tipo/logica |
| --- | --- |
| `user_id` | riferimento obbligatorio a `users.id` |
| `capability` | `owner` oppure `assistant` |
| `status` | `draft`, `pending_verification`, `active`, `suspended`, `rejected`, `disabled` |
| `onboarding_version` | versione del wizard che ha prodotto i dati |
| `current_step` | chiave stabile dello step di onboarding; `complete` per il backfill legacy |
| `completed_at` | completamento dei dati richiesti |
| `activated_at` | attivazione operativa/pubblica |
| `suspended_at` | sospensione amministrativa |
| `disabled_at` | disattivazione volontaria o amministrativa |
| `created_at`, `updated_at` | timestamp Unix |

Vincoli e indici:

- chiave primaria composta `(user_id, capability)`, quindi una sola riga per capability e account;
- indice di discovery `(capability, status, user_id)` per le future query Assistant attive;
- foreign key verso `users` con `ON DELETE CASCADE` per evitare capability orfane;
- check constraint per capability e stati ammessi.

La foreign key è una scelta consapevole rispetto alle tabelle legacy, che in gran parte affidano l'integrità al codice applicativo: la nuova relazione è strettamente dipendente dall'account e non ha uno storico autonomo da conservare dopo la cancellazione dell'utente.

## Regola di backfill

- Tutti gli account esistenti ricevono `owner / active`.
- Gli account con `users.role = pet_assistant` ricevono anche `assistant / active`.
- Le righe legacy sono marcate `current_step = complete`, con onboarding versione 1.
- Il backfill usa `INSERT IGNORE`: rieseguire la migration non sovrascrive stati già esistenti e non può riattivare una capability sospesa o disabilitata.
- `users.role` non viene modificato o rimosso.

## Compatibilità delle scritture

`UserAccount` effettua temporaneamente dual-write:

- una registrazione legacy Owner crea la capability Owner;
- una registrazione legacy Assistant crea Owner e Assistant;
- registrazione o collegamento social aggiungono le capability mancanti senza modificare quelle esistenti;
- la cancellazione account elimina esplicitamente le capability, oltre alla protezione della foreign key;
- creazione account e capability avvengono nella stessa transazione.

Il generatore demo, lo snapshot SQL, l'export e la pulizia CMS sono stati adeguati alla nuova tabella. Questo evita che un ripristino dati effettuato tra STEP 2 e STEP 3 produca account senza capability.

## Migrazione del database locale

Backup immediatamente precedente all'applicazione:

```text
php/storage/app/private/backups/changeaccount-step2-before-20261110.sql
```

Il dump intermedio è stato ritirato dal workspace dopo il cutover definitivo; restano conservati il backup pre-STEP 0 e quello immediatamente precedente allo STEP 10.

| Proprietà | Valore |
| --- | --- |
| Dimensione | 384.569 byte |
| SHA-256 | `70de1995c8ed06fedd55942fa9164cb33211e96300a71666b7eba19aafb58ea3` |
| Utenti prima | 41 |
| Ruoli prima | 1 Owner, 40 Assistant |
| Tabelle capability dopo | 81 righe |
| Capability Owner | 41 attive |
| Capability Assistant | 40 attive |
| Mapping mancanti/errati | 0 |
| Profili dopo | 41 `personaldata`, 40 `operatordata`, 1 `ownerpet` |

Il dump contiene dati personali, resta nello storage privato ed è escluso da Git.

## Verifiche eseguite

1. Restore del dump pre-STEP 0 in database temporaneo isolato.
2. Dump delle tabelle legacy critiche prima della migration.
3. Applicazione completa di `migration.txt` aggiornato.
4. Confronto byte-per-byte delle tabelle `users`, `social_accounts`, `personaldata`, `operatordata`, `ownerpet` e `booking`: invariato.
5. Verifica mapping: 41 Owner, 40 Assistant, 0 mancanti, 0 errati, 0 orfani.
6. Seconda applicazione della migration: ancora 81 righe, quindi backfill idempotente.
7. Applicazione al database locale dopo dump dedicato: stessi conteggi e mapping.
8. Test automatici PHP: 34 test, 183 assertion.
9. Ricostruzione da zero con `migration.txt`, configurazione, snapshot demo e seed olistico: 41 utenti, 81 capability, 0 errori di mapping.
10. Lint e build frontend superati; 575 moduli trasformati.
11. Smoke HTTP: home, registrazione, ricerca, pagine profilo, profilo pubblico e API pubbliche in HTTP 200.
12. Login email reale dell'Assistant demo e lettura API del relativo profilo: HTTP 200.

## Rollback

Lo schema è additivo e non viene ancora letto per autorizzare o mostrare funzionalità. Il rollback preferito durante la finestra STEP 2 consiste nel:

1. ripristinare il codice precedente allo STEP 2, fermando il dual-write;
2. lasciare `user_capabilities` presente ma inutilizzata, perché non altera il comportamento legacy;
3. eliminare la tabella soltanto se strettamente necessario e solo dopo aver verificato che nessuno STEP successivo abbia scritto stati di onboarding non ricostruibili;
4. per un ripristino completo dei dati usare prima un database isolato e il dump STEP 2 sopra indicato.

Non ripristinare il dump sul database operativo senza fermare le scritture: sostituirebbe tutte le modifiche utente successive alla sua creazione.

## Gate manuale STEP 2

Prima dell'approvazione verificare:

- login e apertura profilo Pet Owner esistente;
- login e apertura profilo Pet Assistant esistente;
- ricerca Assistant e apertura di almeno un profilo pubblico;
- assenza di variazioni visibili nella navigazione: lo switch multi-profilo non è ancora previsto in questo step.

Con esito positivo rispondere **OK STEP 2**. Lo STEP 3 introdurrà account neutro, lettura capability con fallback legacy e risposta `/auth/me` estesa.
