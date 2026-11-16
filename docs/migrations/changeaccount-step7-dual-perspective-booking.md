# STEP 7 — Prenotazioni a doppia prospettiva

Data: 16 novembre 2026

Branch: `changeaccount`

Stato milestone: **approvata manualmente — OK STEP 7 ricevuto il 16 novembre 2026**.

## Obiettivo

Permettere allo stesso account di gestire contemporaneamente prenotazioni inviate come Pet Owner e ricevute come Pet Assistant, senza dedurre il lato dal campo legacy `users.role`.

Lo STEP 7 rende esplicita la prospettiva nel contratto API e nelle policy di dominio. Non introduce ancora lo switch globale dell'interfaccia: le pagine profilo Owner e Assistant continuano a essere ingressi distinti fino allo STEP 9.

## Contratto `perspective`

I valori ammessi sono:

```text
owner
assistant
```

| Operazione | Prospettiva ammessa |
| --- | --- |
| elenco prenotazioni | `owner|assistant` |
| creazione singola/batch | `owner` |
| accettazione e rifiuto | `assistant` |
| proposta e alternative di riprogrammazione | `assistant` |
| risposta alla riprogrammazione | `owner` |
| annullamento | lato effettivamente occupato, Owner o Assistant |
| recensione | lato effettivamente occupato, Owner o Assistant |
| modalità di conferma | `assistant` |

`GET /api/bookings` richiede la query `perspective`. Le mutazioni ricevono lo stesso campo nel JSON. L'assenza o un valore non valido produce `422`.

## Conferme UI delle decisioni

Le azioni che cambiano definitivamente la decisione sulla richiesta non vengono inviate al primo click:

- l'Assistant conferma in modale **Accetta prenotazione** o **Rifiuta prenotazione**;
- l'Owner conferma in modale **Accetta nuovo orario** o **Rifiuta proposta**;
- la modale riepiloga numero prenotazione, pet oppure fascia proposta e permette di tornare indietro;
- durante l'invio entrambi i comandi vengono disabilitati per impedire doppi click;
- l'annullamento continua a usare la modale irreversibile dedicata già presente.

## Autorizzazione

Il modello `Booking` applica due verifiche indipendenti:

1. l'account deve possedere la capability richiesta in stato `active`;
2. per una prenotazione esistente, l'ID sessione deve coincidere con `owner_user_id` o `assistant_user_id` in base alla prospettiva dichiarata.

Un account con entrambe le capability può quindi leggere due inbox separate. Dichiarare una prospettiva posseduta ma non corrispondente al lato della specifica prenotazione produce `404`, evitando di rendere azionabile la relazione dal contesto sbagliato. Una capability non attiva produce `403`.

Le route di creazione/batch hanno anche `portal.capability:owner`; modalità di conferma e riepilogo attivo Assistant hanno `portal.capability:assistant`. Le azioni su una prenotazione sono controllate nel dominio perché la capability richiesta dipende dal payload e dal lato della relazione.

## Divieto self-booking

Owner e Assistant devono essere account distinti. La regola è applicata:

- nel profilo pubblico tramite `canBook=false` e `isOwnProfile=true`;
- nel form, che non invia la richiesta sul proprio profilo;
- nel modello prima di pet, slot e transazione;
- nel database tramite `chk_booking_distinct_participants`.

Sugli schemi esistenti il check viene aggiunto soltanto se non esistono self-booking storici. Eventuali anomalie bloccano l'aggiunta del solo vincolo e devono essere analizzate: la migration non cancella prenotazioni o storico automaticamente.

## Recensioni contestuali

`booking_review` aggiunge:

| Campo | Valori | Funzione |
| --- | --- | --- |
| `reviewer_capability` | `owner|assistant` | prospettiva dalla quale viene scritta la recensione |
| `reviewed_capability` | `owner|assistant` | profilo reputazionale che riceve il delta |

Il backfill ricava entrambe le capability confrontando reviewer/reviewed con i lati della prenotazione. Sono presenti due check e l'indice `(reviewed_user_id, reviewed_capability, created_at)`.

Le recensioni Owner→Assistant alimentano il profilo pubblico e possono pubblicare il testo previo consenso. Le recensioni Assistant→Owner modificano esclusivamente la reputazione Owner. Il controller ora inoltra correttamente anche `publishComment` al modello.

## Notifiche ed email action

Ogni destinatario email conserva una prospettiva esplicita. Il link “Gestisci prenotazione” punta rispettivamente a:

```text
/profile/petowner?section=bookings&perspective=owner
/profile/petassistant?section=bookings&perspective=assistant
```

I token monouso di cancellazione restano legati a booking e utente. Il lato viene derivato dalla partecipazione alla prenotazione; il divieto self-booking rende la derivazione non ambigua.

## Compatibilità

- `users.role` non viene più usato per autorizzare o selezionare l'inbox booking.
- Gli account privi di qualsiasi riga capability conservano il fallback legacy centralizzato di `UserCapability`.
- Se le nuove colonne recensione non sono ancora presenti durante un deploy misto, la scrittura mantiene temporaneamente il formato precedente; dopo la migration viene eseguito il backfill.
- `user_reputation` resta un mirror legacy; i delta primari continuano a essere applicati a `profile_reputation(owner|assistant)`.
- La pagina home continua a scegliere la vista iniziale dal ruolo legacy fino allo switch UI dello STEP 9.

## Backup locale

Backup completo immediatamente precedente all'applicazione dello STEP 7:

```text
php/storage/app/private/backups/changeaccount-step7-before-20261116.sql
```

Il dump intermedio è stato ritirato dal workspace dopo il cutover definitivo; restano conservati il backup pre-STEP 0 e quello immediatamente precedente allo STEP 10.

| Proprietà | Valore |
| --- | --- |
| Dimensione | 407.534 byte |
| SHA-256 | `14fc2e5005597bad0efadb403022fce171e4265c91f1ca0397ec6c09b9ffcb10` |
| Utenti | 41 |
| Prenotazioni | 2 |
| Self-booking | 0 |
| Recensioni | 0 |
| Riprogrammazioni | 0 |

Il dump contiene dati personali, resta nello storage privato ignorato da Git e non deve essere pubblicato.

## Verifiche eseguite

1. Suite backend: 60 test, 324 asserzioni.
2. Account dual-role con ruolo legacy Owner: inbox Owner e Assistant separate e accessibili tramite capability.
3. Accettazione Assistant riuscita nonostante `users.role=pet_owner`.
4. Azione dalla prospettiva errata respinta e self-booking bloccato prima della transazione.
5. Recensioni Owner→Assistant e Assistant→Owner salvate con capability distinte e delta reputazione isolati.
6. Route fisse protette anche da middleware Owner/Assistant.
7. Migration su schema vuoto eseguita due volte: due colonne, tre check e indice contestuale presenti.
8. Restore pre-STEP 0: 41 utenti e 2 prenotazioni invariati; 81 capability ricostruite; seconda esecuzione idempotente.
9. Backfill recensione di prova deliberatamente classificata in modo errato: corretta in `owner→assistant` al rerun.
10. Database locale: due prenotazioni e zero recensioni invariati; zero self-booking; tre check presenti.
11. Smoke HTTP con account Assistant dual-role: inbox Owner `200`, inbox Assistant `200`, richiesta senza prospettiva `422`, proprio profilo `canBook=false`, altro profilo `canBook=true`.
12. Lint PHP, build TypeScript/Vite e controllo diff superati.
13. Audit visuale dei due profili: 66 classi condivise confrontate sugli stili calcolati senza divergenze sostanziali; intestazione località su componente condiviso, caricamento Nunito `500/700/800/900`, favicon e convenzione del titolo HTML uniformati. La pagina Owner non ricade più sul fallback Trebuchet MS.

## Rollback

Il rollback applicativo preferito è:

1. fermare temporaneamente le mutazioni booking;
2. ripristinare il codice dello STEP 6;
3. lasciare colonne, indici e check additivi presenti ma inutilizzati;
4. riaprire le scritture dopo verifica delle due inbox legacy.

Il codice precedente ignora le nuove colonne. Non rimuovere `reviewer_capability` e `reviewed_capability` dopo che sono state create recensioni dual-role: perderne il contesto renderebbe ambiguo l'audit. Il check anti self-booking è compatibile anche con il modello precedente e può restare.

Per un ripristino totale usare prima un database isolato e il dump privato indicato sopra. Un restore completo sostituisce tutte le modifiche successive al backup.

## Gate manuale STEP 7 — approvato

Gate approvato dall'utente il **16 novembre 2026** con `OK STEP 7`.

Verificare:

- dal profilo Owner, la sezione prenotazioni mostra soltanto richieste inviate;
- dal profilo Assistant, la sezione mostra soltanto richieste ricevute;
- un account con entrambe le capability può aprire entrambe le sezioni senza cambiare credenziali;
- accetta/rifiuta/riprogramma sono disponibili soltanto dal lato Assistant;
- la risposta alla proposta è disponibile soltanto dal lato Owner;
- accetta e rifiuta, in entrambe le prospettive, aprono sempre una modale e non inviano l'azione al primo click;
- annullamento e recensione operano nella prospettiva visualizzata;
- sul proprio profilo pubblico non è possibile prenotare;
- sul profilo di un altro Assistant l'account dual-role può prenotare usando i propri pet;
- i link email aprono la pagina Owner o Assistant corretta.
- la scritta “INDIRIZZO LOCAZIONE” ha lo stesso stile nei profili Owner e Assistant.

La checklist è stata confermata e la milestone può essere consolidata nel commit isolato.
