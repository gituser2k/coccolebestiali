# Baseline STEP 0 — migrazione account multi-profilo

Data della rilevazione: **9 novembre 2026**

Branch: `changeaccount`

Commit di partenza: `dd6964107f2bbcd0e4879bdc4107e1f124bd2b7b`

Scopo: fotografia verificabile prima di modificare autenticazione, schema o comportamento del portale.

## Stato Git iniziale

Il working tree era pulito all'avvio dello STEP 0. Il presente report, il feature flag e gli aggiornamenti documentali sono le sole modifiche versionabili introdotte dallo step.

## Baseline automatica

| Controllo | Risultato |
| --- | --- |
| `composer test` | 15 test superati, 71 assertion |
| `npm run lint` | superato senza segnalazioni |
| `npm run build` | superato, 574 moduli trasformati |
| Database test backend | SQLite `:memory:`; nessuna mutazione del database MAMP |
| Smoke HTTP locale | HTTP 200 per home, register, search, profili Owner/Assistant, auth config e auth me |

## Fingerprint delle fonti

| File | SHA-256 |
| --- | --- |
| `php/migration/migration.txt` | `ddc0d4db3160ebc8666f7494e1b3697c3b251a14cfa27eebe6faf5c468ac6537` |
| `php/composer.lock` | `de2ce3fc3bc06c116fc303794f85b8a3e710e6a2e1c30018589292243f0aa1c6` |
| `html/package-lock.json` | `ab3f578472352712ff652c8de20ecb6f7cc02d0a0ca8b3f5436585514089872d` |

## Backup database

Il dump è conservato sul disco privato Laravel, ignorato da Git:

```text
php/storage/app/private/backups/changeaccount-step0-20261109-220602.sql
```

| Proprietà | Valore |
| --- | --- |
| Dimensione | 383.507 byte |
| Righe | 1.345 |
| SHA-256 | `0994a34701f156b8f39d8bf801f97ca410c8fb10faaf7a9431e0caa17bcc7e37` |
| Tabelle nel database sorgente | 43 |
| Verifica restore | riuscita in database temporaneo isolato |
| Tabelle dopo restore | 43 |
| Utenti dopo restore | 41 |
| Database temporaneo | rimosso dopo la verifica |

Il dump può contenere dati personali e non deve essere versionato, copiato in aree pubbliche o condiviso. Prima di usarlo verificare nuovamente il checksum.

Il 10 novembre 2026 è stato inoltre creato il tag annotato `db-pre-step0-20261109`, puntato al commit precedente allo STEP 0, e il manifesto versionato `php/migration/backups/pre-step0-20261109.md`. Una seconda prova di ripristino isolato ha riconfermato 43 tabelle, 41 utenti e 2 prenotazioni; il database temporaneo è stato eliminato al termine.

## Conteggi dati critici

| Entità | Record |
| --- | ---: |
| `users` | 41 |
| `users.role = pet_owner` | 1 |
| `users.role = pet_assistant` | 40 |
| `social_accounts` | 1 |
| `personaldata` | 41 |
| `operatordata` | 40 |
| `ownerpet` | 1 |
| `operator_public_profile` | 0 |
| `calendar_day` | 919 |
| `booking` | 2 |
| `booking_review` | 0 |
| `user_reputation` | 41 |
| `reputation_event` | 0 |
| `pet_assistant_favorite` | 1 |

Questi conteggi sono indicatori di confronto, non sostituiscono i controlli di integrità e contenuto dei backfill futuri.

## Inventario dell'accoppiamento al ruolo

Ricerca lessicale iniziale su `role`, `pet_owner`, `pet_assistant` e `PORTAL_USER_ROLE`:

| Area | Occorrenze | File |
| --- | ---: | ---: |
| Backend `php/app` + `php/routes` | 126 | 11 |
| Frontend `html/src` | 212 | 17 |
| Script di migrazione/seed | 101 | non normalizzato |

File backend direttamente coinvolti:

- `AuthController.php`
- `BookingController.php`
- `PetAssistantSearchController.php`
- `ProfileController.php`
- `PublicPetAssistantController.php`
- `Admin.php`
- `Booking.php`
- `DemoData.php`
- `PetAssistantSearch.php`
- `PublicPetAssistant.php`
- `UserAccount.php`

Il conteggio frontend include anche attributi ARIA/HTML chiamati `role`; negli step successivi deve essere usato come baseline lessicale, non come numero di controlli autorizzativi.

## Feature flag

È stato aggiunto `config/features.php` con:

```text
CB_MULTI_PROFILE_ENABLED=false
```

Il flag non è ancora consumato dal codice applicativo e non cambia il comportamento. Verrà collegato esclusivamente quando un percorso multi-profilo completo sarà disponibile e approvato.

## Strategia di rollback

Per lo STEP 0 non è stata applicata alcuna modifica al database né al comportamento runtime.

- Rollback codice: revert delle sole modifiche documentali/configurative dello step.
- Rollback configurazione: mantenere o ripristinare `CB_MULTI_PROFILE_ENABLED=false`.
- Rollback DB futuro: interrompere le scritture, verificare checksum del dump, ripristinare prima su database isolato e confrontare i conteggi; il ripristino sul database di lavoro richiede una decisione esplicita perché sostituisce i dati successivi al dump.
- Il dump privato non viene rimosso automaticamente dal rollback del codice.

## Gate STEP 0

Lo step è tecnicamente superato se:

- test backend, lint e build sono verdi;
- il backup esiste, il checksum corrisponde e il restore isolato riesce;
- i conteggi iniziali sono registrati;
- il feature flag è presente e disattivato;
- architettura e changelog sono aggiornati;
- il comportamento osservabile del portale è invariato.
