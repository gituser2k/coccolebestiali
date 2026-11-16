# Upgrade sicurezza Laravel 12

Data: 16 novembre 2026
Branch: `changeaccount`

## Obiettivo

Chiudere i cinque advisory Composer residui di Laravel 11 rilevati nell'audit globale precedente allo STEP 9, mantenendo PHP MAMP 8.3.30 e il comportamento applicativo esistente.

## Modifica

- vincolo `laravel/framework` aggiornato da `^11.0` a `^12.71`;
- lockfile aggiornato da Laravel `11.57.1` a `12.72.0`;
- aggiunto automaticamente `symfony/polyfill-php84` `1.43.0`;
- nessun altro pacchetto rimosso e nessuna modifica a schema o dati;
- piattaforma Composer mantenuta su PHP `8.3.30`.

## Compatibilità verificata

Le aree di breaking change indicate dalla guida Laravel 12 sono state confrontate con il codice. Il portale non usa model UUID Eloquent, API `Concurrency`, URL temporanei del filesystem o merge di request dipendente dal vecchio comportamento. Gli accessi storage esistenti usano `exists`, `path`, `download` e `delete` con percorsi espliciti.

## Collaudo

- `composer audit --locked`: nessun advisory;
- `composer validate --strict`: valido;
- requisiti runtime e sviluppo verificati con PHP MAMP 8.3.30;
- 66 test backend e 380 asserzioni superati;
- 107 route applicative caricate dopo `optimize:clear`;
- smoke HTTP `200` per home, configurazione auth, profili Owner/Assistant e ricerca;
- lint e build frontend superati;
- `npm audit --omit=dev`: zero vulnerabilità;
- invarianti DB invariate: zero capability duplicate, Owner mancanti, Assistant pubblicati senza Alias/Città, self-favorite e self-booking.

## Rollback

Il rollback non richiede operazioni sul database. Ripristinare `composer.json` e `composer.lock` alla revisione precedente ed eseguire `composer install` con PHP MAMP 8.3.30, quindi `artisan optimize:clear` e la suite completa.
