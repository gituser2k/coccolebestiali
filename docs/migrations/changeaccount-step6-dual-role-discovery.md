# STEP 6 — Discovery dual-role

Data: 10 novembre 2026

Branch: `changeaccount`

Stato milestone: **approvata manualmente — “OK STEP 6” ricevuto il 16 novembre 2026**.

## Obiettivo

Rimuovere dalla discovery il vincolo per cui soltanto un account con `users.role = pet_assistant` può essere trovato e soltanto un account con `users.role = pet_owner` può usare pet e preferiti. Un account globale può ora operare come Owner e risultare contemporaneamente Assistant, in base alle capability attive.

Lo STEP 6 non modifica la prospettiva delle prenotazioni e non introduce ancora lo switch visuale Owner/Assistant. `viewerRole` resta temporaneamente nel profilo pubblico per evitare di abilitare il form booking prima delle policy dello STEP 7.

## Policy centralizzata

`App\Models\UserCapability` espone tre primitive:

| Funzione | Responsabilità |
| --- | --- |
| `hasActive(userId, capability, legacyRole?)` | autorizzazione puntuale Owner/Assistant |
| `activeForUser(userId, legacyRole?)` | elenco delle capability attive usato dai contratti API |
| `scopeActive(query, userAlias, capability, capabilityAlias)` | filtro SQL riusabile per query di discovery |

La regola di compatibilità è fail-closed:

- se l'account possiede almeno una riga in `user_capabilities`, quel set è autoritativo;
- una capability assente, sospesa, disabilitata o incompleta non viene ricostruita dal vecchio ruolo;
- `users.role` è usato soltanto se l'account non possiede alcuna riga capability;
- nel fallback legacy un Assistant conserva entrambe le funzioni, mentre un Owner conserva la sola funzione Owner.

Gli alias SQL passati a `scopeActive()` vengono validati prima di essere interpolati nella query.

## Ricerca e profilo pubblico

`PetAssistantSearch` e `PublicPetAssistant` filtrano ora i candidati con capability Assistant `active`. Ne consegue che:

- un account legacy Owner con capability Assistant attiva compare nella ricerca e ha un profilo pubblico;
- sospendere la capability Assistant lo rimuove da entrambi senza disattivare l'account Owner;
- i profili legacy senza righe capability restano temporaneamente raggiungibili;
- un set capability parziale non ottiene permessi per deduzione dal ruolo.

Le opzioni di ricerca restituiscono anche:

```text
activeCapabilities: string[]
canUseOwnerDiscovery: boolean
canFilterFavorites: boolean
```

Il profilo pubblico restituisce:

```text
viewerCapabilities: string[]
canFavorite: boolean
```

Il frontend usa questi flag per pet, filtro preferiti e pulsante Preferito. Non usa più il ruolo legacy per tali funzioni.

## Autorizzazione dei preferiti

Le route:

```text
GET /api/pet-assistant-favorites
PUT /api/pet-assistants/{assistantId}/favorite
```

sono protette in sequenza da `portal.auth` e `portal.capability:owner`. Il nuovo middleware `RequireActiveCapability` legge esclusivamente `portal_user_id`, già risolto dalla sessione server-side, e restituisce `401` senza identità o `403` senza capability attiva.

La policy viene ripetuta nel modello per impedire che una chiamata interna aggiri il middleware.

## Divieto self-favorite

Quando lo stesso account possiede entrambe le capability, non può aggiungere il proprio profilo Assistant ai preferiti. Il vincolo è applicato a tre livelli:

1. controller: risposta HTTP `422` con messaggio esplicito;
2. modello: eccezione `SELF_FAVORITE_NOT_ALLOWED`;
3. database: check `chk_favorite_distinct_accounts` su `owner_user_id <> assistant_user_id`.

Anche lettura e lista preferiti escludono difensivamente eventuali righe self-reference.

## Modifica database

La migration cumulativa:

1. elimina eventuali self-favorite legacy;
2. crea in modo condizionale il check `chk_favorite_distinct_accounts`;
3. resta rieseguibile senza duplicare il vincolo.

Sul database locale prima dell'applicazione erano presenti due preferiti e zero self-favorite. Dopo la migration i conteggi sono rimasti invariati e il check risulta presente.

Questa è una modifica di integrità con cleanup mirato, non una rimozione di schema. Nessun account, profilo o preferito valido viene modificato.

## Backup locale

Backup completo immediatamente precedente all'applicazione dello STEP 6:

```text
php/storage/app/private/backups/changeaccount-step6-before-20261110-220848.sql
```

| Proprietà | Valore |
| --- | --- |
| Dimensione | 407.477 byte |
| SHA-256 | `d717e2d74bef396602e27ff74c49582ab789257cfe36819418c9ce588519f0e1` |
| Capability | 81 totali: 41 Owner, 40 Assistant |
| Preferiti | 2 |
| Self-favorite | 0 |

Il dump contiene dati personali, resta nello storage privato ignorato da Git e non deve essere pubblicato.

## Verifiche eseguite

1. Suite backend: 58 test, 304 asserzioni.
2. Test capability: account dual-role incluso, Assistant sospeso escluso, fallback legacy ammesso soltanto senza righe, stato parziale fail-closed.
3. Test API: route preferiti protette da sessione e capability Owner; `403` per Owner sospeso; `422` sul self-favorite.
4. Test dominio: profilo pubblico dual-role visibile, Assistant sospeso escluso e difesa del modello contro self-favorite.
5. Restore pre-STEP 0 e migration ripetuta: 81 capability, nessun self-favorite, check presente, dati legacy invariati.
6. Backup e migration del database locale: 41 Owner, 40 Assistant, due preferiti validi invariati.
7. Ricostruzione MySQL da zero con migration, configurazione, snapshot demo e seed olistico: 41 utenti, 81 capability e check presente.
8. Prova reale del motore di ricerca su DB isolato: utente con `role=pet_owner` e capability Assistant attiva trovato tra 13 candidati e nel profilo pubblico; dopo sospensione della capability escluso da entrambi.
9. Smoke HTTP con account Assistant dual-role: entrambe le capability, filtro preferiti disponibile, altro profilo preferibile, proprio profilo non preferibile e PUT self-favorite respinta con `422` JSON.
10. Lint PHP, controllo diff e build frontend superati.

## Rollback

Il rollback applicativo consiste nel ripristinare il codice dello STEP 5 lasciando il check DB, che vieta soltanto una relazione priva di significato anche nel modello legacy.

Se fosse indispensabile ripristinare integralmente lo stato precedente:

1. fermare le scritture dei preferiti;
2. provare il dump privato in un database isolato;
3. ripristinare codice e database in modo coordinato;
4. riaprire le scritture soltanto dopo verifica dei conteggi.

La rimozione del check non è normalmente necessaria. Un eventuale rollback SQL isolato non deve reintrodurre self-favorite.

## Gate manuale STEP 6

Verificare:

- con account Pet Assistant, ricerca e filtri Owner restano utilizzabili;
- il pulsante Preferito compare sugli altri profili Assistant;
- il pulsante non compare sul proprio profilo Assistant;
- con account Pet Owner legacy, ricerca e preferiti non cambiano;
- ricerca, scheda pubblica, ranking e posizione degli Assistant esistenti restano invariati;
- il form di prenotazione non viene ancora abilitato in una nuova prospettiva: appartiene allo STEP 7.

Gate completato con **OK STEP 6** il 16 novembre 2026. Il changeset può essere consolidato nel commit isolato dello step.
