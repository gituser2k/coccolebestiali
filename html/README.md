# Coccole Bestiali Frontend

Questo frontend vive in:

- `/Applications/XAMPP/xamppfiles/htdocs/coccolebestiali/html`

Ed e costruito con:

- `React`
- `TypeScript`
- `Vite`
- `Tailwind CSS`

## Struttura attuale

- `src/pages/` contiene le pagine React.
- `src/css/` contiene i CSS per pagina.
- `src/html/` contiene gli entry point HTML gestiti da Vite.
- `src/tsx/` contiene i bootstrap file che montano le singole pagine.
- `src/assets/` contiene immagini e asset grafici.

## Comandi utili

Sviluppo locale:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/coccolebestiali/html
npm run dev
```

Build produzione:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/coccolebestiali/html
npm run build
```

Importante:

- `npm run build` va sempre eseguito dentro la cartella `html/`.
- Non usare la root del progetto per i comandi npm, perche li non esiste `package.json`.

## Regola definitiva per le nuove form

Questa regola nasce dalla correzione effettuata sulla pagina:

- `/profile/petassistant`

ed e da considerare il criterio standard per tutte le future pagine interne.

### 1. Mobile first, ma con controllo esplicito del tablet

Non basta verificare solo:

- desktop largo
- mobile stretto

La fascia piu delicata e spesso il tablet, in particolare viewport simili a:

- `1024x1366`
- `1366x768`

Se una sezione ha:

- due colonne
- una mappa
- campi affiancati
- label lunghe
- dropdown o autocomplete

allora deve avere un breakpoint tablet dedicato prima del mobile puro.

### 2. Quando una sezione deve andare in stacking

Se una sezione contiene blocchi complessi, per esempio:

- form a sinistra
- mappa o card a destra
- `indirizzo` e `numero civico` sulla stessa riga

non bisogna aspettare il breakpoint mobile per forzare `grid-template-columns: 1fr`.

Regola pratica:

- desktop ampio: layout a colonne
- tablet: stacking anticipato se i campi iniziano a comprimersi
- mobile: layout a colonna completa

Nel profilo pet assistant questa regola e gia applicata in:

- [profile.css](/Applications/XAMPP/xamppfiles/htdocs/coccolebestiali/html/src/css/profile.css)

con breakpoint tablet dedicato per il blocco indirizzo.

### 3. Cosa non va toccato se una parte e gia corretta

Se una sezione e gia stata validata visivamente, le correzioni future devono essere:

- locali
- chirurgiche
- limitate al blocco problematico

Esempio corretto:

- correggere solo `.profile-location-grid`
- lasciare invariata la sezione alta con alias, email, nome e foto

Questo evita regressioni su parti gia approvate.

### 4. Regola di spaziatura dei campi form

Per i campi con label sopra input:

- la distanza verticale label-campo deve essere uniforme
- se una sezione ha una distribuzione speciale, conviene lavorare sul contenitore reale che gestisce l'impilamento

Nel progetto si e visto che, per la sezione alta del profilo, la soluzione corretta non era forzare margini generici, ma:

- organizzare bene il blocco sinistro
- distribuire i campi nella colonna corretta
- mantenere la foto nella colonna separata

Questa e la logica da riutilizzare nelle prossime form.

## Procedura obbligatoria di verifica visuale

Per ogni modifica grafica importante bisogna sempre fare verifica reale con screenshot.

Viewport minime da controllare:

- `3840x2160`
- `1920x1080`
- `1366x768`
- `1024x1366`
- una viewport mobile, ad esempio `430x932`

Se il cambiamento tocca spaziature o comportamento responsive, la verifica non e opzionale.

### Criteri di controllo

Controllare sempre:

- centratura generale dei blocchi
- equilibrio tra colonna sinistra e destra
- assenza di sovrapposizioni tra label, input e componenti
- assenza di tagli o compressioni anomale
- resa coerente su mobile senza rompere cio che era gia corretto

### Tecnica operativa da riutilizzare

Usare Playwright per generare screenshot della pagina reale su `http://localhost/...`.

Esempio:

```bash
cd /Applications/XAMPP/xamppfiles/htdocs/coccolebestiali/html
node --input-type=module
```

Poi generare screenshot per le viewport necessarie.

Cartella consigliata:

- `html/screenshots/`

## Principio operativo per il futuro

Da ora in poi, nella costruzione di altre form:

1. si sviluppa il layout
2. si verifica il desktop
3. si verifica obbligatoriamente il tablet
4. si verifica il mobile
5. si corregge solo il blocco che fallisce
6. si rigenera la build con `npm run build`

Questo e il criterio definitivo da seguire per evitare regressioni e mantenere un livello grafico professionale e stabile.
