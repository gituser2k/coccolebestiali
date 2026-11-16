# STEP 4 — Separazione dei dati di profilo

Data: 10 novembre 2026

Branch: `changeaccount`

Stato milestone: **approvata manualmente — “OK STEP 4” ricevuto il 10 novembre 2026**.

## Obiettivo

Separare i dati personali condivisi dall'indirizzo usato nelle due prospettive dell'account:

- identità comune: nome, foto, età e telefono;
- residenza Owner: città, indirizzo e coordinate per distanze e servizi;
- area operativa Assistant: città, sede, coordinate e raggio di servizio.

La separazione evita che l'attivazione futura di entrambe le capability costringa l'utente a usare lo stesso indirizzo come residenza privata e sede di lavoro. Lo STEP 4 non introduce ancora lo switch grafico e non modifica le autorizzazioni legacy basate su `users.role`.

## Schema introdotto

### `account_profile`

Una riga per account, con PK/FK `user_id -> users.id ON DELETE CASCADE`:

| Campo | Significato |
| --- | --- |
| `name` | nominativo condiviso |
| `photo` | foto profilo condivisa tra prospettive |
| `age` | età, vincolata tra 0 e 120 |
| `phone` | recapito condiviso |
| `created_at`, `updated_at` | timestamp Unix |

### `owner_profile`

Una riga opzionale per account, con PK/FK `user_id -> users.id ON DELETE CASCADE`:

| Campo | Significato |
| --- | --- |
| `city`, `address`, `address_number` | residenza/località Owner |
| `location_lat`, `location_lng` | coordinate della residenza |
| `created_at`, `updated_at` | timestamp Unix |

Le coordinate hanno check geografici; `city` è indicizzata.

### `assistant_profile`

Una riga opzionale per account, con PK/FK `user_id -> users.id ON DELETE CASCADE`:

| Campo | Significato |
| --- | --- |
| `city`, `address`, `address_number` | sede/area operativa Assistant |
| `location_lat`, `location_lng` | coordinate operative |
| `service_radius_km` | raggio operativo, vincolato tra 1 e 200 km |
| `created_at`, `updated_at` | timestamp Unix |

Sono indicizzati `city` e la coppia di coordinate.

## Backfill e regola anti-contaminazione

Il backfill è additivo e idempotente tramite `INSERT IGNORE`:

1. ogni riga `personaldata` alimenta `account_profile` per i campi comuni;
2. solo gli account con ruolo legacy `pet_owner` trasferiscono la location in `owner_profile`;
3. solo gli account con ruolo legacy `pet_assistant` trasferiscono location e raggio in `assistant_profile`.

È intenzionale non copiare l'area operativa degli Assistant in `owner_profile`: una sede di lavoro non può essere assunta come residenza privata. Quando un Assistant userà la prospettiva Owner, completerà la residenza nel relativo profilo.

Sul database locale il risultato è:

| Tabella | Righe |
| --- | ---: |
| `account_profile` | 41 |
| `owner_profile` | 1 |
| `assistant_profile` | 40 |

Non sono presenti mismatch rispetto ai rispettivi campi sorgente né righe nel contesto errato.

## Compatibilità applicativa

`App\Models\ProfileData` concentra la lettura e la scrittura dei tre profili:

- legge prima le nuove tabelle;
- usa `personaldata` come fallback durante deploy misti o per righe non ancora migrate;
- applica il fallback della location soltanto quando il ruolo legacy coincide con il contesto richiesto;
- salva i dati nuovi e mantiene temporaneamente un mirror in `personaldata`;
- aggiorna nel mirror legacy la location soltanto per la prospettiva corrispondente a `users.role`.

Questa ultima regola consente a un Assistant legacy di salvare una futura residenza Owner senza sovrascrivere l'area operativa che il vecchio runtime continua a leggere. Vale simmetricamente per un Owner che compila l'area Assistant.

`ProfileController` specifica sempre il contesto Owner o Assistant. `Profile` mantiene una firma opzionale compatibile per i chiamanti legacy. Foto e dati comuni restano condivisi.

## Ricerca, scheda pubblica e mappe

`PetAssistantSearch` e `PublicPetAssistant` leggono:

- foto da `account_profile`;
- città e coordinate da `assistant_profile`;
- `personaldata` solo se lo schema o la riga nuova non sono disponibili.

La presenza di una riga nuova, anche con valori vuoti, è autoritativa: il fallback non può resuscitare un vecchio indirizzo cancellato. La distanza dell'Owner usa invece esclusivamente `owner_profile`, con fallback legacy limitato agli Owner storici.

Le API mantengono i campi preesistenti. La risposta del profilo personale aggiunge `profileSources`, utile per diagnosticare se i dati provengono dalle nuove tabelle, dal fallback legacy o da un profilo ancora vuoto.

## Seed, export, cancellazione e storage

- `seed_pet_assistants.php` genera sia `account_profile` sia `assistant_profile`.
- `seed_demo_data.sql` ricostruisce i tre profili dal dataset legacy.
- `export_current_profiles.php` include le nuove tabelle e individua le foto comuni.
- `DemoData` include le nuove tabelle nell'ordine corretto di pulizia/ripristino.
- La cancellazione account rimuove esplicitamente i tre profili, oltre alle FK cascade, e censisce la foto comune tra i file da eliminare.
- `personaldata` resta temporaneamente nello snapshot e nel runtime come mirror di compatibilità; sarà rimosso solo nello STEP 10 dopo aver eliminato tutti i consumatori legacy.

## Backup locale

Backup completo immediatamente precedente all'applicazione dello STEP 4:

```text
php/storage/app/private/backups/changeaccount-step4-before-20261110-213218.sql
```

Il dump intermedio è stato ritirato dal workspace dopo il cutover definitivo; restano conservati il backup pre-STEP 0 e quello immediatamente precedente allo STEP 10.

| Proprietà | Valore |
| --- | --- |
| Dimensione | 393.376 byte |
| SHA-256 | `79366967c48e970e5146223604f0a3f96d8ddd4e9ebe0dd47cb7e064a7ff4309` |
| Utenti prima | 41 |
| `personaldata` prima | 41 |

Il dump contiene dati personali, resta nello storage privato ignorato da Git e non deve essere pubblicato.

## Verifiche eseguite

1. Suite backend completa: 48 test, 252 asserzioni.
2. Cinque test dedicati a fallback per ruolo, separazione bidirezionale, dual-write, foto condivisa e persistenza HTTP delle coordinate Owner.
3. Restore isolato del dump pre-STEP 0 e applicazione della migration aggiornata.
4. Backfill isolato 41/1/40, zero mismatch e zero righe nel contesto sbagliato.
5. Seconda applicazione sullo stesso restore: conteggi invariati, quindi idempotenza confermata.
6. Confronto prima/dopo di `users` e `personaldata`: invariati.
7. Dump privato del database locale e applicazione della migration: stessi conteggi, zero mismatch e zero orfani.
8. Ricostruzione da zero con migration e seed versionati: 41/1/40, tre FK e sei indici complessivi sulle tre tabelle.
9. Smoke HTTP: scheda pubblica Assistant 200, login email Assistant 200, `/auth/me` 200, profilo Assistant 200 con sorgenti nuove, ricerca 200 con otto risultati e città coerenti.
10. Controllo sintassi PHP e `git diff --check` senza errori.
11. Generatore PHP su database temporaneo: 40 utenti, 40 profili comuni, 40 aree Assistant, zero mismatch.
12. Lint e build frontend superati; 575 moduli trasformati.

## Rollback

Lo schema è additivo e `personaldata` rimane aggiornato, quindi il rollback applicativo è possibile senza perdita dei campi legacy:

1. fermare temporaneamente le scritture;
2. ripristinare il codice dello STEP 3;
3. lasciare le nuove tabelle presenti ma inutilizzate, scelta preferita;
4. eliminare le nuove tabelle solo se indispensabile e dopo un export, perché potrebbero contenere una seconda location non rappresentabile in `personaldata`;
5. per un ripristino totale usare prima un database isolato e il dump privato indicato sopra.

Dopo che un account avrà salvato entrambe le location, un rollback al solo `personaldata` non potrà rappresentarle entrambe. Per questo il rollback distruttivo dello schema non è consigliato.

## Gate manuale STEP 4

Verificare:

- login e apertura del profilo personale Pet Owner esistente;
- login e apertura del profilo personale Pet Assistant esistente;
- per l'Assistant, città, indirizzo, mappa e raggio uguali a prima;
- ricerca Assistant e apertura di almeno una scheda pubblica, controllando città e mappa;
- nessuna variazione visibile inattesa nei dati comuni, nella foto o nei pet.

Gate completato con **OK STEP 4** il 10 novembre 2026. Il changeset può essere consolidato nel commit isolato dello step.
