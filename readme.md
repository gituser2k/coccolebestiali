# Coccolebestiali Demo Stack

Questo progetto e stato organizzato in due aree:

- `php/` contiene il backend con **Laravel 13**.
- `html/` contiene il frontend con **React + TypeScript + Inertia.js + Tailwind + Vite**.

## Cosa e stato installato

### Sistema
- `php` e `composer` installati via Homebrew.

### Backend (`php/`)
- Laravel `^13.0` creato con Composer.
- Pacchetto `inertiajs/inertia-laravel` installato.
- Route API demo attiva: `GET /api/inertia-demo` (file `php/routes/api.php`).
- Bootstrap Laravel aggiornato per caricare anche le route API (`php/bootstrap/app.php`).

### Frontend (`html/`)
- Progetto Vite con template React + TypeScript.
- Dipendenze aggiunte:
  - `@inertiajs/react`, `@inertiajs/core`
  - `tailwindcss`, `@tailwindcss/vite`
  - `axios`
- Vite configurato con:
  - plugin React + Tailwind
  - proxy `/api -> http://127.0.0.1:8000`
  - entry multipli `index.html` e `demo.html`

## Pagina demo richiesta

La pagina principale di esempio e:

- `html/demo.html`

Questa pagina monta React da `html/src/demo.tsx` e renderizza il componente:

- `html/src/pages/DemoPage.tsx`

Nella demo:

- **React** gestisce UI e stato.
- **TypeScript** tipizza payload backend/frontend (`DemoPageProps`).
- **Inertia.js** e usato in due modi:
  - bootstrap iniziale con `createInertiaApp`
  - navigazione/refresh con `router.visit(...)` e `<Link ... />`
- **Tailwind CSS** gestisce layout, stile, responsive e componenti UI.
- **Vite** compila e serve la pagina `demo.html`.
- **Laravel 13** espone i dati runtime e stack via route Inertia `api/inertia-demo`.

## Come avviare la demo

Apri due terminali.

### 1) Backend Laravel
```bash
cd /Users/bitnethic/PROGETTI/coccolebestiali/php
php artisan serve
```

### 2) Frontend Vite
```bash
cd /Users/bitnethic/PROGETTI/coccolebestiali/html
npm run dev
```

Poi apri:

- `http://127.0.0.1:5173/demo.html`

## Verifiche eseguite

- Build frontend completata con successo: `npm run build` in `html/`.
- Route backend confermata: `php artisan route:list --path=api` in `php/`.
