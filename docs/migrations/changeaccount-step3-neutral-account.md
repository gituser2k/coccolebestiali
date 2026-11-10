# STEP 3 — Account neutro e compatibilità backend

Data: 10 novembre 2026

Branch: `changeaccount`

Stato milestone: **approvata manualmente — “OK STEP 3” ricevuto il 10 novembre 2026**.

## Obiettivo

Consentire al backend di creare e descrivere un account globale senza richiedere una scelta esclusiva Owner/Assistant, mantenendo nel contempo compatibilità con frontend, link email e account legacy.

Lo STEP 3 non introduce ancora lo switch grafico né il wizard “Diventa Pet Assistant”: questi appartengono agli STEP 8 e 9. `users.role` resta quindi disponibile come campo di compatibilità per le autorizzazioni non ancora migrate.

## Registrazione neutra

Gli endpoint email, Google, Apple e Apple mock accettano ora `role` come parametro opzionale:

- senza `role`, il nuovo account riceve il valore tecnico legacy `pet_owner` e la capability Owner attiva;
- con `role=pet_owner|pet_assistant`, il vecchio frontend continua a funzionare senza modifiche;
- un nuovo account creato dal vecchio percorso Assistant riceve Owner e Assistant attive, come previsto dal backfill;
- valori diversi dai due ruoli legacy vengono respinti dalla validazione.

Il valore `pet_owner` usato internamente per una registrazione neutra non rappresenta più una scelta irreversibile: è soltanto il default compatibile necessario finché controller e frontend legacy leggono ancora `users.role`.

## Social login non distruttivo

`UserAccount::upsertSocialUser()` distingue adesso account nuovo e account esistente:

- per un account nuovo inizializza ruolo legacy e capability;
- per un account trovato tramite provider/subject o email verificata aggiorna esclusivamente dati identificativi e collegamento social;
- non modifica mai `users.role` di un account esistente;
- provisiona eventuali righe mancanti usando il ruolo già memorizzato, non quello ricevuto dalla richiesta;
- usa `insertOrIgnore`, quindi non riattiva capability `suspended` o `disabled`.

Questo impedisce che un login o una registrazione social possano rimuovere, sostituire o riattivare capacità già assegnate.

## Contratto utente e `/api/auth/me`

La risposta utente conserva i campi esistenti e aggiunge:

```json
{
  "role": "pet_assistant",
  "capabilities": [
    {
      "capability": "owner",
      "status": "active",
      "onboardingVersion": 1,
      "currentStep": "complete",
      "completedAt": 0,
      "activatedAt": 0,
      "suspendedAt": 0,
      "disabledAt": 0
    }
  ],
  "activeCapabilities": ["owner", "assistant"],
  "modes": {
    "available": ["owner", "assistant"],
    "default": "assistant"
  },
  "capabilitySource": "user_capabilities"
}
```

`modes.default` preserva inizialmente la prospettiva legacy quando la relativa capability è attiva. Se la capability Assistant è sospesa o disabilitata, il default torna a Owner. La modalità è una preferenza di presentazione e non concede autorizzazioni.

## Dual-read e fallback

`UserCapability::resolveForUser()`:

1. legge `user_capabilities` quando la tabella e le righe sono disponibili;
2. se la tabella manca o l'account non è stato backfillato, sintetizza temporaneamente le capability dal ruolo legacy;
3. espone la provenienza come `user_capabilities` oppure `legacy_fallback`;
4. non scrive durante una lettura fallback, evitando effetti collaterali su login e `/auth/me`.

Il fallback consente deploy misti e rollback applicativi, ma deve essere rimosso soltanto nello STEP 10 dopo la verifica completa dei dati.

## Conferma email

I nuovi link di conferma non contengono più il ruolo e firmano tramite HMAC `email|expires`. Per non invalidare email già inviate, il verificatore continua ad accettare i link legacy firmati `email|role|expires` quando il parametro `role` è presente.

Il testo della nuova email parla di “account Coccole Bestiali” e non di profilo Owner o Assistant.

## Database e compatibilità

- Nessuna tabella, colonna, indice o dato è stato modificato nello STEP 3.
- Il database locale conserva 41 utenti e 81 capability create nello STEP 2.
- Le API e la UI esistenti possono continuare a leggere `role`.
- La pagina `/register` continua temporaneamente a inviare il ruolo selezionato; verrà sostituita dal form neutro nella home nello STEP 8.
- Nessun account doppio esistente viene unito automaticamente.

## Verifiche automatiche

- registrazione email senza ruolo: account Owner tecnico e sola capability Owner;
- compatibilità del payload legacy Assistant: Owner e Assistant attive;
- registrazione Google senza ruolo;
- registrazione Apple mock senza ruolo, mantenendo il vincolo ambiente `local`;
- social upsert su account esistente: ruolo invariato e Assistant sospesa non riattivata;
- fallback capability per account senza backfill;
- nessuna modalità UI disponibile quando tutte le capability sono inattive;
- `/auth/me` con ruolo legacy e nuovo contratto capability;
- link email con firma nuova e legacy;
- test di sicurezza provider/subject dello STEP 1 ancora verdi;
- test complessivi: 43 test, 223 assertion.

Smoke test sul database locale:

```text
login=200
auth/me=200
role=pet_assistant
capabilities=2
active=owner,assistant
default=assistant
source=user_capabilities
```

## Rollback

Il rollback è esclusivamente applicativo:

1. ripristinare `AuthController`, `UserAccount` e `UserCapability` alla versione STEP 2;
2. non modificare né eliminare `user_capabilities`;
3. i nuovi account creati senza ruolo restano validi perché hanno comunque `users.role=pet_owner` e capability Owner;
4. i link email nuovi richiedono il verificatore STEP 3: durante l'eventuale rollback va mantenuto temporaneamente il supporto alla firma `email|expires`, oppure tali link diventerebbero inutilizzabili.

## Gate manuale STEP 3

Verificare:

- login e navigazione del Pet Owner esistente;
- login e navigazione del Pet Assistant esistente;
- login Google/Apple di account già registrati, controllando che il profilo aperto resti quello corretto;
- logout e nuovo login senza perdita di dati o cambio di profilo;
- assenza di uno switch multi-profilo prematuro nell'interfaccia.

Con esito positivo rispondere **OK STEP 3**.
