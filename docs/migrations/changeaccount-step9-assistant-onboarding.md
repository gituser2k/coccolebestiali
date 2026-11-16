# STEP 9 — onboarding e switch Pet Assistant

Data: 16 novembre 2026
Branch: `changeaccount`
Stato milestone: **approvata con gate manuale “OK STEP 9” il 16 novembre 2026**.

## Obiettivo

Consentire allo stesso account di restare Pet Owner e aprire facoltativamente un profilo Pet Assistant, senza nuove credenziali e senza usare la modalità visuale come autorizzazione.

## Ciclo di vita

`POST /api/profile/petassistant/onboarding/start` crea idempotentemente la capability Assistant in `draft`. La capability Owner non viene modificata. Una bozza può compilare i moduli Assistant ma non è ricercabile, non riceve prenotazioni e non può essere selezionata come modalità operativa.

Gli stati `suspended`, `rejected` e `disabled` non vengono riattivati dal comando di avvio. Un eventuale recupero richiede una decisione amministrativa distinta.

## Checklist e requisiti di pubblicazione

La percentuale di completezza viene ricalcolata dal server sui dati persistiti e resta una guida per migliorare il profilo. Comprende:

1. nome e telefono comuni;
2. città, indirizzo e coordinate dell'area operativa Assistant;
3. codice fiscale per persona oppure denominazione/P. IVA per associazione;
4. biografia, titolo professionale e almeno un tipo di animale;
5. almeno un servizio con tariffa positiva;
6. foto struttura quando un servizio selezionato la richiede;
7. almeno una fascia futura abilitata nel calendario;
8. email verificata.

Gli indicatori restano disponibili nel contratto server per il calcolo della percentuale, ma la griglia dettagliata non viene mostrata nel pannello di bozza e non blocca la pubblicazione. Il gate minimo di `POST /activate` controlla invece, sempre sui dati persistiti, i soli campi contrassegnati come obbligatori nella sezione Dati personali: `Alias` (`users.name`) e `Città` (`assistant_profile.city`). Il passaggio da `draft|pending_verification` ad `active` è transazionale e valorizza `completed_at`, `activated_at` e `current_step=complete`.

Il pulsante di pubblicazione resta cliccabile anche quando mancano dati. Se Alias o Città non sono stati salvati, il server risponde `422`, elenca `missingRequiredFields` e il client apre Dati personali mostrando il messaggio di correzione. Non esiste un comando manuale “Aggiorna verifica”: lo stato viene ricaricato automaticamente dopo ogni salvataggio riuscito di dati personali, operatore o calendario.

Dopo una pubblicazione riuscita, il nuovo stato `active` forza immediatamente il ricalcolo dello switch di modalità: “Completa profilo Assistant” viene sostituito da “Pet Assistant” senza ricaricare manualmente la pagina.

## Modalità UI

`POST /api/auth/mode` accetta `owner|assistant`, verifica la capability attiva e salva `cb_portal_ui_mode` nella sessione Laravel. `/api/auth/me` restituisce `modes.current`. La preferenza decide home e link profilo, ma ogni API continua a verificare la capability e, per le prenotazioni, la prospettiva effettiva.

La home e i due profili mostrano lo switch quando Assistant è attivo. Per un account solo Owner mostrano “Diventa Pet Assistant”; per una bozza mostrano “Completa profilo Pet Assistant”.

## Autorizzazioni

- gli endpoint Owner richiedono `portal.capability:owner`;
- i moduli Assistant richiedono il middleware `portal.assistant-profile`, che ammette solo `draft`, `pending_verification` o `active`;
- discovery e booking Assistant continuano a richiedere `active`;
- l'accesso a una bozza non implica pubblicazione;
- la modalità di sessione non concede permessi.

## Database e backup

Non vengono create o alterate tabelle. Sono riusati i campi dello STEP 2 in `user_capabilities`.

Backup privato pre-STEP 9:

```text
php/storage/app/private/backups/changeaccount-step9-before-20261116.sql
```

| Proprietà | Valore |
| --- | --- |
| Dimensione | 409.844 byte |
| SHA-256 | `9b4e4d0d329bdefad9d79f4950d078215eb8f9a8f9f70bb66024c85f407d5999` |
| Utenti | 42 |
| Capability | 82 |
| Assistant attivi | 40 |
| Bozze Assistant | 0 |

Il dump contiene dati personali, resta ignorato da Git e non deve essere pubblicato.

## Verifiche eseguite

- avvio idempotente della bozza e preservazione Owner attivo;
- bozza non attiva e switch Assistant respinto con `403`;
- attivazione senza Alias/Città respinta con `422`, campi mancanti e messaggio esplicito;
- attivazione con i soli Alias/Città salvati riuscita anche con checklist informativa incompleta;
- stato sospeso non riattivabile;
- compatibilità di un Assistant reale esistente: stato attivo e checklist 100%;
- suite completa: 66 test, 380 asserzioni;
- lint frontend senza errori e build Vite completata;
- smoke browser della home e del profilo Owner con CTA/switch corretti;
- pulsanti della checklist dimensionati con padding proporzionato al testo e larghezza mobile fluida, evitando sia bordi troppo vicini sia larghezze desktop eccessive;
- menu dei comuni ancorato al campo Città nei profili Owner/Assistant e mostrato soltanto dopo due caratteri, senza card vuote al focus;
- ricerca comuni normalizzata senza distinzione tra maiuscole/minuscole (`roma`, `Roma`, `ROMA`) e con risposta nel formato canonico del dataset;
- aggiunta la qualifica catalogo `Operatore Olistico` (`operatortitle.id=6`) nel database locale, nella migration idempotente e nel seed di configurazione; la qualifica è visibile in ricerca/profilo ma non altera la prenotazione;
- chiarito e distanziato il form Profilo pubblico: i quattro campi sono facoltativi, visibili al Pet Owner prima della prenotazione e privi di effetti su prezzo, disponibilità e contratto booking;
- spostato il consenso alla posizione pubblica esatta nella sezione mappa Assistant; viene salvato insieme ai Dati personali senza modificare gli altri testi del profilo pubblico;
- integrata `Presentazione (bio)` nella card Profilo pubblico, subito dopo il titolo e con lo stesso formato visuale degli altri contenuti pubblici;
- `git diff --check` superato.

## Rollback

Il rollback del codice può lasciare le righe Assistant `draft`: gli STEP precedenti le ignorano perché discovery e booking richiedono `active`. Per annullare una singola bozza senza dati operativi si può disabilitarla amministrativamente; non cancellare automaticamente profili o file. Per un ripristino totale usare prima un database isolato e il dump privato.

## Gate manuale STEP 9

I controlli manuali sono stati dichiarati completati dall'utente il 16 novembre 2026. Il successivo audit globale ha confermato:

- 66 test backend e 380 asserzioni superati;
- lint e build frontend superati, `npm audit` senza vulnerabilità;
- 98 route API caricate, incluse 13 route Pet Assistant con middleware capability/profilo e rate limit sull'attivazione;
- 42 utenti, 42 capability Owner attive e 41 capability Assistant attive; nessuna bozza residua dopo il collaudo manuale;
- zero capability duplicate/orfane, account senza Owner attivo, Assistant attivi senza Alias/Città, self-favorite e self-booking;
- catalogo `Operatore Olistico` presente una sola volta;
- backup pre-STEP 9 ancora integro: 409.844 byte e checksum invariato;
- requisiti Composer compatibili con PHP MAMP 8.3.30 e file Composer valido;
- `git diff --check` superato.

Il rischio dipendenza censito nell'audit STEP 8 è stato chiuso prima del gate: Laravel è stato aggiornato da 11.57.1 a 12.72.0 e `composer audit` non segnala più advisory. Le mitigazioni applicative esistenti restano attive.

Verificare con un account Owner:

- la home mostra “Diventa Pet Assistant” senza perdere le funzioni Owner;
- il comando apre il profilo Assistant in bozza;
- la percentuale di completezza si aggiorna automaticamente dopo i salvataggi, senza mostrare la griglia dettagliata degli indicatori;
- la bozza non compare nella ricerca e non mostra l'inbox prenotazioni Assistant;
- “Pubblica profilo” resta cliccabile e, se mancano Alias o Città salvati, apre Dati personali con un messaggio esplicito;
- dopo il salvataggio di Alias e Città, la pubblicazione abilita lo switch Owner/Assistant senza imporre le altre sezioni;
- lo switch cambia home e profilo ma non mescola dati, location o prenotazioni;
- tornando a Owner, pet, preferiti e prenotazioni inviate restano disponibili;
- layout desktop e mobile non presentano overflow.

Gate approvato dall'utente il 16 novembre 2026; milestone pronta per il consolidamento nel commit isolato.
