# Audit globale — gate STEP 8

Data: 16 novembre 2026  
Branch: `changeaccount`  
Perimetro: stato cumulativo degli STEP 0–8.

## Esito

Il collaudo globale non ha rilevato regressioni bloccanti. Lo STEP 8 è stato approvato dall'utente il 16 novembre 2026. La registrazione è unica e neutra, i profili Owner e Assistant restano separati nei dati specifici ma coesistono sullo stesso account, e le operazioni migrate usano capability e prospettiva esplicite.

## Codice, route e compatibilità

- branch e sequenza dei commit STEP 0–7 verificati;
- nessun errore di whitespace con `git diff --check`;
- 104 route censite, senza duplicati metodo/URI;
- `/register` risponde `302` verso `/?auth=register`;
- home, ricerca, profili Owner/Assistant e profilo Assistant pubblico rispondono `200`;
- endpoint profilo non autenticato respinto con `401` e mutazione senza CSRF con `419`;
- il consumo del ruolo legacy resta confinato ai punti di compatibilità documentati e sarà eliminato negli STEP 9–10.

## Database e recuperabilità

Il database locale contiene 48 tabelle. Il controllo read-only ha rilevato:

- zero capability orfane o duplicate;
- zero account privi della capability Owner attiva;
- zero self-favorite e self-booking;
- zero recensioni con capability incoerenti;
- zero profili account, Owner o Assistant orfani;
- presenza dei check anti self-booking e di coerenza recensioni;
- presenza degli indici per ranking, discovery, reputazione e recensioni.

Sono stati ricontrollati esistenza e checksum dei backup privati pre-STEP 0 e pre-STEP 2/4/5/6/7. Il tag `db-pre-step0-20261109` è presente. Lo STEP 8 non modifica schema o dati.

## Funzionalità e uniformità visuale

Il collaudo browser ha coperto home predefinita, login, registrazione, alias `/register`, ricerca, profili Owner/Assistant e profilo pubblico:

- nessun errore console e nessun overflow orizzontale;
- login e registrazione sono mutuamente esclusivi e coerenti con `?auth=login|register`;
- chiusura, back e forward ripristinano URL, CTA e focus;
- le password vengono azzerate alla chiusura;
- viewport mobile 390×844 verificata sulle viste principali;
- 66 classi condivise dei profili confrontate senza divergenze di stile calcolato;
- `profile-location-kicker` è identico nei profili Owner e Assistant, inclusi font, peso, line-height, spaziatura, colore e gap.

Le azioni prenotazione non erano presenti nel dataset corrente per un nuovo click-through browser; modali, prospettive e autorizzazioni sono coperte dai test dello STEP 7 e dal relativo gate manuale.

## Sicurezza e dipendenze

- suite backend: 61 test e 326 asserzioni con PHP MAMP 8.3.30;
- lint PHP: 52 file senza errori di sintassi;
- build TypeScript/Vite completata;
- `npm audit`: zero vulnerabilità, incluse le dipendenze di sviluppo;
- Laravel aggiornato da 11.51.0 a 11.57.1 nella stessa major;
- rimosso l'advisory critico TokenGuard;
- requisiti del lockfile verificati contro PHP 8.3.30;
- header difensivi presenti nelle risposte reali MAMP.

`composer audit` segnala ancora cinque advisory Laravel 11. La correzione completa richiede almeno Laravel 12.71 e deve essere svolta come upgrade major dedicato. Le superfici più rilevanti sono già ridotte: CR/LF email è bloccato globalmente e testato; la conferma email usa HMAC applicativo anziché URL Laravel temporaneamente firmati; in produzione resta obbligatorio `APP_DEBUG=false`. Gli advisory restano comunque rischio residuo finché il framework non viene aggiornato.

Aggiornamento del 16 novembre 2026: il rischio è stato chiuso dopo l'audit STEP 9 aggiornando Laravel a 12.72.0. `composer audit` non segnala più advisory; suite, route, smoke HTTP e requisiti PHP 8.3.30 sono stati ricontrollati.

## Decisione di gate

Non sono emerse condizioni che richiedano il rollback dello STEP 8. Il gate è approvato; i rischi residui non introdotti dallo STEP 8 restano nel registro architetturale e nel documento sicurezza dello STEP 1.
