# Migrazioni database Coccole Bestiali

## Fonte dello schema

Il file [`migration.txt`](./migration.txt) è la fonte cumulativa dello schema MySQL/MariaDB del portale.

Il progetto non usa al momento le migration versionate standard di Laravel. Il file contiene:

- creazione del database;
- creazione idempotente delle tabelle con `CREATE TABLE IF NOT EXISTS`;
- indici e vincoli univoci;
- dati iniziali necessari al portale e al CRM;
- aggiornamenti compatibili con database già esistenti.

Il segnaposto `{{DB_DATABASE}}` viene sostituito con il valore `DB_DATABASE` presente in `php/.env`. In questo modo il nome del database non è codificato nello script.

## Esecuzione con MAMP

Prima di applicare lo script è consigliato creare un backup del database.

Da Terminale:

```bash
cd /Applications/MAMP/htdocs/coccolebestiali/php

DB_NAME=$(sed -n 's/^DB_DATABASE=//p' .env | head -1)
DB_USER=$(sed -n 's/^DB_USERNAME=//p' .env | head -1)
DB_PASSWORD=$(sed -n 's/^DB_PASSWORD=//p' .env | head -1)
DB_PORT=$(sed -n 's/^DB_PORT=//p' .env | head -1)

sed "s/{{DB_DATABASE}}/${DB_NAME}/g" migration/migration.txt \
  | /Applications/MAMP/Library/bin/mysql80/bin/mysql \
      --host=127.0.0.1 \
      --port="${DB_PORT}" \
      --user="${DB_USER}" \
      --password="${DB_PASSWORD}"
```

Lo script può essere rieseguito per ripristinare tabelle o seed mancanti. Prima di usarlo su un ambiente diverso verificare che il client MySQL di MAMP sia disponibile nel percorso indicato.

## Tabelle per area funzionale

### Account e profili

| Tabella | Funzione |
| --- | --- |
| `users` | Account, ruolo, alias, email e credenziali. |
| `social_accounts` | Collegamenti con Google e Apple. |
| `personaldata` | Dati personali, recapiti e coordinate GPS. |
| `operatordata` | Informazioni professionali del Pet Assistant. |
| `operatorassociatedata` | Associati collegati a un operatore di tipo associazione. |
| `user_reputation` | Punteggio corrente, inizializzato a 60/100. |
| `reputation_event` | Registro immutabile delle variazioni del ranking. |

### Prenotazioni e recensioni

| Tabella | Funzione |
| --- | --- |
| `booking_counter` | Progressivo annuale utilizzato dai numeri di prenotazione. |
| `booking` | Prenotazione, partecipanti, pet, servizio, orario, costo e stato. |
| `booking_reschedule` | Proposte strutturate di riprogrammazione. |
| `booking_review` | Recensioni reciproche collegate a servizi conclusi. |
| `booking_action_token` | Token monouso per le azioni sicure inviate via email. |

Le prenotazioni richiedono almeno 24 ore di anticipo e riservano intervalli contigui di 30 minuti. Il comando pianificato Laravel riconcilia ogni cinque minuti richieste scadute e servizi conclusi; in produzione va eseguito con `php artisan schedule:work` oppure tramite cron con `php artisan schedule:run`.

### Configurazione professionale

| Tabella | Funzione |
| --- | --- |
| `operatortitle` | Qualifiche professionali disponibili. |
| `operatortitledata` | Qualifiche selezionate dal Pet Assistant. |
| `petbreed` | Catalogo delle razze. |
| `petbreeddata` | Razze gestite dal Pet Assistant. |
| `pettype` | Catalogo delle caratteristiche comportamentali del pet. |
| `pettypedata` | Caratteristiche accettate dal Pet Assistant. |
| `housefeature` | Catalogo delle caratteristiche della casa. |
| `housefeaturedata` | Caratteristiche della casa selezionate dall’operatore. |
| `operatorgallery` | Gallery della casa del Pet Assistant. |

### Pet del proprietario

| Tabella | Funzione |
| --- | --- |
| `ownerpet` | Dati anagrafici di ogni pet: nome, sesso, data di nascita, microchip, note generali e taglia. |
| `ownerpetbreeddata` | Razze associate al singolo pet. |
| `ownerpettypedata` | Caratteristiche associate al singolo pet. |
| `ownerpetgallery` | Foto, didascalie e ordine della gallery del singolo pet. |
| `ownerpetdocument` | Documenti privati, metadati, date e percorso del file associati al singolo pet. |

Relazioni principali:

```text
users.id
  └── ownerpet.user_id
        ├── ownerpetbreeddata.pet_id ── petbreed.id
        ├── ownerpettypedata.pet_id  ── pettype.id
        ├── ownerpetgallery.pet_id
        └── ownerpetdocument.pet_id
```

I file della gallery non vengono salvati nel database. `ownerpetgallery.photo` contiene il percorso relativo sul disco pubblico Laravel, normalmente:

```text
owner-pet-gallery/nome-file.png
```

Il file fisico si trova in:

```text
php/storage/app/public/owner-pet-gallery/
```

I documenti del pet sono invece riservati. `ownerpetdocument.file_path` contiene il percorso relativo sul disco Laravel `local`; i file sono conservati in:

```text
php/storage/app/private/owner-pet-documents/user-<ID_UTENTE>/
```

Il download passa sempre dalla rotta autenticata `/api/profile/petowner/pets/documents/{id}`, che verifica l'appartenenza del documento all'utente in sessione. Sono ammessi PDF, JPG, PNG e WebP fino a 10 MB. Le categorie comprendono libretto sanitario, certificato anagrafe/microchip, passaporto UE, vaccinazioni, certificati sanitari, referti, prescrizioni, sterilizzazione, assicurazione, adozione/proprieta, pedigree e altri documenti.

### Servizi e calendario

| Gruppo | Tabelle principali |
| --- | --- |
| Servizi | `service`, `servicefeature`, `servicefeaturedata` |
| Configurazione operatore | `operatorservicedata`, `operatorservicefeaturedata` |
| Disponibilità | `calendar_day`, `calendar_day_slot`, `calendar_day_slot_service` |

### Messaggi e diagnostica

| Tabella | Funzione |
| --- | --- |
| `message` | Richieste inviate dalla modale contatti. |
| `messageback` | Risposte amministrative ai messaggi. |
| `error` | Errori applicativi registrati dal backend. |

## Dataset locale dei Pet Assistant

Lo script [`seed_pet_assistants.php`](./seed_pet_assistants.php) ripulisce tutte le registrazioni utente e genera 40 profili Pet Assistant di sviluppo sulla città di Roma.

L'operazione conserva i cataloghi CRM, i servizi, i messaggi e lo storico degli errori. Vengono invece rimossi account, profili, relazioni, calendari e file gallery appartenenti agli utenti precedenti.

Prima dell'esecuzione creare sempre un backup del database. Per rigenerare il dataset:

```bash
cd /Applications/MAMP/htdocs/coccolebestiali/php
/Applications/MAMP/bin/php/php8.3.30/bin/php migration/seed_pet_assistants.php --force
```

Credenziali generate:

```text
email:    utente1@email.it ... utente40@email.it
password: pass1             ... pass40
```

L'accesso avviene esclusivamente tramite email e password.

Il dataset varia in modo deterministico:

- coordinate GPS distribuite nell'area di Roma;
- raggio operativo;
- tipo operatore;
- qualifica ed esperienza;
- taglia, razze e tipologie di pet;
- caratteristiche della casa;
- servizi, funzionalità abilitate e prezzi orari.
- calendari distribuiti casualmente per il mese successivo, con giornate attive e non attive, fasce non sovrapposte e servizi realmente configurati dall'operatore.
- almeno dieci Pet Assistant compatibili con Rex (`frabe75@gmail.com`): Pastore Tedesco, taglia grande e carattere docile.

Per rigenerare esclusivamente i calendari dei 40 Pet Assistant, senza modificare account e profili:

```bash
cd /Applications/MAMP/htdocs/coccolebestiali/php
/Applications/MAMP/bin/php/php8.3.30/bin/php migration/seed_pet_assistant_calendars.php --force
```

L'intervallo parte dal giorno di esecuzione e termina un mese dopo. Il risultato casuale e riproducibile per lo stesso intervallo di date; ogni fascia usa minuti multipli di 15 e soltanto servizi associati al Pet Assistant.

Le password brevi del dataset sono destinate esclusivamente allo sviluppo locale e non devono essere utilizzate in produzione.

## Snapshot sistema e dati demo

Gli snapshot riproducono lo stato corrente del portale in due blocchi indipendenti:

- [`seed_system_configuration.sql`](./seed_system_configuration.sql) ripristina servizi, funzionalita, qualifiche, razze, tipi di pet, caratteristiche casa e policy;
- [`seed_demo_data.sql`](./seed_demo_data.sql) ripristina 1 Pet Owner, Rex, 40 Pet Assistant e tutti i dati operativi collegati, inclusi profili, calendari, ranking e prenotazioni;
- [`demo_storage`](./demo_storage) contiene le immagini pubbliche e i documenti privati referenziati dal dataset demo; `manifest.json` ne descrive i percorsi.

Prima degli snapshot deve essere sempre applicato `migration.txt`. I pulsanti nella sezione **Dati demo** del CMS eseguono separatamente i due ripristini; **CREA DATI DEMO** ripulisce i dati operativi prima dell'importazione e ricopia automaticamente immagini e documenti nelle cartelle Laravel.

La stessa sezione offre tre operazioni distinte:

- **SVUOTA TUTTO IL DATABASE** elimina tutti i record da tutte le tabelle, mantenendone la struttura;
- **RIPRISTINA DATI DI SISTEMA** ricrea esclusivamente cataloghi, configurazione e policy;
- **CREA DATI DEMO** ricrea account e dati operativi esattamente come nello snapshot corrente.

Il collaudo completo deve eseguire i tre comandi in questo ordine e confrontare tutte le tabelle con lo stato precedente allo svuotamento. Lo snapshot corrente non contiene prenotazioni pregresse.

Per importarli manualmente con MAMP:

```bash
cd /Applications/MAMP/htdocs/coccolebestiali/php

DB_NAME=$(sed -n 's/^DB_DATABASE=//p' .env | head -1)
DB_USER=$(sed -n 's/^DB_USERNAME=//p' .env | head -1)
DB_PASSWORD=$(sed -n 's/^DB_PASSWORD=//p' .env | head -1)
DB_PORT=$(sed -n 's/^DB_PORT=//p' .env | head -1)

/Applications/MAMP/Library/bin/mysql80/bin/mysql \
  --host=127.0.0.1 \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASSWORD}" \
  "${DB_NAME}" < migration/seed_system_configuration.sql

/Applications/MAMP/Library/bin/mysql80/bin/mysql \
  --host=127.0.0.1 \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --password="${DB_PASSWORD}" \
  "${DB_NAME}" < migration/seed_demo_data.sql
```

Per rigenerare lo snapshot a partire dal database corrente:

```bash
/Applications/MAMP/bin/php/php8.3.30/bin/php migration/export_current_profiles.php
```

La rigenerazione aggiorna entrambi i file SQL, svuota la precedente cartella `demo_storage` e ricopia soltanto i file effettivamente referenziati dal database corrente. Deve essere eseguita solo quando il database contiene esattamente 1 Pet Owner e 40 Pet Assistant.

## Regole per gli aggiornamenti futuri

Quando viene aggiunta o modificata una struttura dati:

1. Aggiornare sempre `migration.txt` nello stesso intervento di backend e frontend.
2. Usare nomi di tabella e colonna coerenti con quelli già presenti.
3. Rendere le istruzioni rieseguibili senza perdere dati esistenti.
4. Aggiungere indici sulle colonne usate per associazioni e ricerche.
5. Documentare in questo file finalità, relazioni e percorsi storage.
6. Verificare lo schema sul database locale MAMP dopo l’esecuzione.
7. Eseguire almeno un test di creazione, lettura, aggiornamento ed eliminazione dei dati coinvolti.

## Policy del portale

La tabella `portal_policy` contiene i valori operativi modificabili dal CMS nella sezione **Policy**. Il backend legge sempre questa tabella tramite `App\Models\PortalPolicy`; i valori definiti nel modello sono fallback di sicurezza e coincidono con quelli iniziali della migration.

La tabella `policy_change_log` conserva uno storico immutabile per ogni salvataggio:

- identificativo univoco del lotto di modifica;
- valori precedenti e nuovi in formato JSON;
- numero di destinatari, email consegnate e invii falliti;
- data e ora della variazione.

Il salvataggio aggiorna solo i valori realmente cambiati e invia un unico riepilogo professionale, tramite destinatari in copia nascosta, a tutti i Pet Owner e Pet Assistant con email verificata. Un errore SMTP non annulla la configurazione: viene salvato nella tabella `error` e riportato nel risultato del CMS.

Le policy governano anticipo e durata delle prenotazioni, tempi di risposta, cancellazioni, penalità, punteggi delle recensioni, ranking iniziale e finestra temporale per recensire. La scala reputazionale resta strutturalmente compresa tra `0` e `100`.

## Verifica delle tabelle Pet Owner

```sql
SHOW TABLES LIKE 'ownerpet%';

SELECT pet.id,
       pet.user_id,
       pet.name,
       pet.sex,
       pet.birth_date,
       pet.microchip_code,
       pet.general_notes,
       pet.pet_size,
       pet.sortorder
FROM ownerpet AS pet
ORDER BY pet.user_id, pet.sortorder;
```

Il primo comando deve mostrare:

- `ownerpet`;
- `ownerpetbreeddata`;
- `ownerpettypedata`;
- `ownerpetgallery`;
- `ownerpetdocument`.

Per verificare nello specifico l'aggiornamento dei dati anagrafici:

```sql
SHOW COLUMNS FROM ownerpet
WHERE Field IN ('sex', 'birth_date', 'microchip_code', 'general_notes');
```
