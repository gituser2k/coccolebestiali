# STEP 5 — Reputazione contestuale

Data: 10 novembre 2026

Branch: `changeaccount`

Stato milestone: **approvata manualmente — “OK STEP 5” ricevuto il 10 novembre 2026**.

## Obiettivo

Separare il ranking maturato come Pet Owner dal ranking maturato come Pet Assistant. Un singolo account può quindi ricevere penalità e recensioni in entrambe le prospettive senza sommare comportamenti eterogenei nello stesso punteggio.

Lo STEP 5 non cambia ancora le autorizzazioni delle prenotazioni né introduce lo switch UI. Prepara il modello dati e converte tutte le scritture di reputazione già esistenti.

## Schema introdotto

### `profile_reputation`

| Campo | Significato |
| --- | --- |
| `user_id` | account, FK verso `users.id` con `ON DELETE CASCADE` |
| `capability` | `owner` oppure `assistant` |
| `score` | punteggio contestuale tra 0 e 100 |
| `updated_at` | timestamp Unix dell'ultima variazione |

La chiave primaria composta `(user_id, capability)` garantisce un solo punteggio per prospettiva. L'indice `(capability, score, user_id)` supporta discovery e ordinamento Assistant. Check constraint limitano capability e score.

### `reputation_event.subject_capability`

Ogni evento indica ora la capability del soggetto a cui è stata applicata la variazione. La colonna accetta solo `owner|assistant` ed è inclusa nell'indice `(user_id, subject_capability, created_at)`.

Il contesto dell'attore non viene ancora memorizzato: per gli eventi correnti il lato della prenotazione è ricavabile da `booking`. L'eventuale estensione delle recensioni con prospettiva esplicita appartiene allo STEP 7.

## Regola di backfill

- Tutti i 41 account ricevono una reputazione Owner.
- Il Pet Owner legacy conserva il proprio punteggio storico nella capability Owner.
- I 40 Pet Assistant legacy conservano il punteggio storico nella capability Assistant.
- Gli stessi 40 Assistant ricevono un punteggio Owner nuovo pari alla policy `initial_reputation_score`, attualmente 60.
- `INSERT IGNORE` non sovrascrive punteggi contestuali già presenti.

Risultato sul database locale:

| Metrica | Valore |
| --- | ---: |
| Righe totali `profile_reputation` | 81 |
| Capability Owner | 41 |
| Capability Assistant | 40 |
| Differenze ranking Assistant rispetto allo storico | 0 |
| Differenze Owner legacy rispetto allo storico | 0 |
| Orfani | 0 |

Gli eventi storici vengono classificati usando prima il lato Owner/Assistant della prenotazione e, solo per eventi senza booking valido, il ruolo legacy del soggetto.

## Scritture applicative

`App\Models\ProfileReputation` centralizza:

- inizializzazione idempotente dei punteggi per un nuovo account;
- lettura contestuale con fallback legacy;
- applicazione transazionale e limitazione dello score a `0..100`;
- creazione dell'evento con `subject_capability`;
- aggiornamento temporaneo del mirror `user_reputation` soltanto quando la capability modificata coincide con `users.role`.

La regola del mirror evita un conflitto non rappresentabile: se un Assistant riceve una penalità come Owner, cambia solo `profile_reputation(owner)`; `user_reputation` continua a rappresentare il suo ranking Assistant per un eventuale rollback applicativo.

Nel fallback di deploy misto il valore legacy viene riusato solo per la capability corrispondente al ruolo storico. Una riga Owner mancante per un Assistant parte quindi dal valore iniziale e non eredita il ranking professionale.

Se l'intera tabella contestuale manca, le scritture restano possibili soltanto per la capability coincidente con il ruolo legacy; una scrittura incrociata viene bloccata perché `user_reputation` non potrebbe conservarla senza corrompere l'altro punteggio.

## Eventi convertiti

| Evento | Capability soggetto |
| --- | --- |
| cancellazione tardiva Owner | `owner` |
| cancellazione/azione tardiva Assistant | `assistant` |
| richiesta scaduta senza risposta | `assistant` |
| recensione inviata dall'Owner all'Assistant | `assistant` |
| recensione inviata dall'Assistant all'Owner | `owner` |

## Query di lettura

- `PetAssistantSearch` ordina e mostra `profile_reputation(assistant)`.
- `PublicPetAssistant` espone `profile_reputation(assistant)`.
- `Booking` restituisce separatamente il punteggio Owner del lato Owner e quello Assistant del lato Assistant.
- Se tabella o riga nuova non sono disponibili, le query usano il mirror soltanto nel contesto compatibile con il ruolo legacy.
- La presenza di una riga contestuale, anche con score `0`, è autoritativa.

## Compatibilità, seed ed export

- `user_reputation` resta presente e viene mantenuta come mirror temporaneo fino allo STEP 10.
- Nuove registrazioni Owner creano la reputazione Owner; il vecchio flusso Assistant crea Owner e Assistant.
- Cancellazione account, pulizia demo, export e snapshot includono `profile_reputation`.
- `seed_demo_data.sql` genera 41 Owner e 40 Assistant.
- `seed_pet_assistants.php` genera 40 Owner iniziali e 40 ranking Assistant differenziati.

## Backup locale

Backup completo immediatamente precedente all'applicazione dello STEP 5:

```text
php/storage/app/private/backups/changeaccount-step5-before-20261110-215036.sql
```

Il dump intermedio è stato ritirato dal workspace dopo il cutover definitivo; restano conservati il backup pre-STEP 0 e quello immediatamente precedente allo STEP 10.

| Proprietà | Valore |
| --- | --- |
| Dimensione | 403.606 byte |
| SHA-256 | `f4700bf72d99c2f6afb86db58691f07597372fc15ca99ab1320b8ce2e3b06859` |
| Utenti | 41 |
| `user_reputation` | 41 |
| Eventi reputazione | 0 |

Il dump contiene dati personali, resta nello storage privato ignorato da Git e non deve essere pubblicato.

## Verifiche eseguite

1. Suite backend: 53 test, 281 asserzioni.
2. Test dedicati a inizializzazione, isolamento delle capability, mirror, fallback, blocco fail-closed dello schema legacy e lettura contestuale autoritativa.
3. Review Owner→Assistant e Assistant→Owner con eventi distinti.
4. Restore del dump pre-STEP 0, backfill 81/41/40 e confronto dei dati legacy.
5. Zero differenze nei ranking preesistenti e zero orfani.
6. Seconda esecuzione della migration con conteggi invariati.
7. Backup e migrazione del database locale con gli stessi risultati.
8. Ricostruzione da zero tramite migration, configurazione e snapshot demo.
9. Generatore PHP isolato: 40 utenti, 80 reputazioni contestuali, zero mismatch.
10. Smoke HTTP della scheda pubblica: ranking 45 sia in API sia nella nuova tabella.
11. Smoke ricerca: HTTP 200, otto risultati, ordinamento per ranking operativo.
12. Lint e build frontend superati; 575 moduli trasformati.
13. Migration su schema vuoto rieseguita due volte con FK, check e indice contestuale presenti.

## Rollback

Il rollback preferito è applicativo:

1. fermare temporaneamente le scritture;
2. ripristinare il codice dello STEP 4;
3. lasciare `profile_reputation` e `subject_capability` presenti ma inutilizzati;
4. continuare a leggere `user_reputation`, che è mantenuta per la prospettiva legacy;
5. non eliminare la nuova tabella dopo che lo stesso account avrà maturato eventi in entrambe le capability: il mirror singolo non può rappresentarli entrambi.

Per un ripristino totale usare prima un database isolato e il dump privato sopra indicato. Un restore operativo sostituirebbe tutte le modifiche successive al backup.

## Gate manuale STEP 5

Verificare:

- ordinamento della ricerca Assistant invariato;
- ranking mostrato nella scheda pubblica di almeno due Assistant invariato;
- apertura delle prenotazioni Owner e Assistant senza variazioni inattese dei punteggi mostrati;
- nessuna differenza visibile nei dati profilo o nel login.

Gate completato con **OK STEP 5** il 10 novembre 2026. Il changeset può essere consolidato nel commit isolato dello step.
