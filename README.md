# TokTickIT

A requester-facing IT service desk for CPE334 Lab 2. A seeded Development Requester can create,
find, and inspect owned Tickets and manage validated Attachments through a responsive Zen Green UI.
The selector is a test context only; real authentication is deferred to Lab 3.

- **Stack:** React + TypeScript + Vite + Bootstrap → Express + TypeScript → Prisma ORM → PostgreSQL
- **Tests:** Vitest (unit/UI) + Supertest (API) + Playwright (E2E/responsive/accessibility)

## Prerequisites

- **Node.js** 18 or newer — developed on v24.13.1
- **PostgreSQL** 16 or newer, running on `localhost:5432` — developed on 18

## Setup

Every command below is written to be run from the repository root, so return there between steps.

### 1. Clone and install

```bash
git clone https://github.com/jakkarin-promsee/toktickit.git
cd toktickit
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### 2. Create the database

Connect as a PostgreSQL superuser and create the role and database the app expects:

```sql
CREATE USER toktickit WITH PASSWORD 'toktickit';
CREATE DATABASE toktickit OWNER toktickit;
ALTER ROLE toktickit CREATEDB;
```

With `psql`, run the three statements one after another:

```bash
psql -U postgres -c "CREATE USER toktickit WITH PASSWORD 'toktickit';"
psql -U postgres -c "CREATE DATABASE toktickit OWNER toktickit;"
psql -U postgres -c "ALTER ROLE toktickit CREATEDB;"
```

> `CREATEDB` is required by `prisma migrate dev` (step 4). Before applying a migration it replays
> the whole `prisma/migrations/` history into a throwaway *shadow database* to detect drift between
> the migration files and `schema.prisma`, then drops it. Without the grant the migration fails with
> `P3014 — permission denied to create database`. Owning the `toktickit` database is not enough:
> creating a database is a separate role attribute.
>
> On Windows `psql` may not be on your `PATH`; it ships at
> `C:\Program Files\PostgreSQL\<version>\bin\psql.exe`.
>
> If you run these in the pgAdmin Query Tool, execute them **one at a time** — `CREATE DATABASE`
> cannot run inside a transaction block, and pgAdmin wraps a multi-statement execution in one.

### 3. Configure environment variables

Both sides ship a `.env.example`. Copy each to `.env` and adjust if your local values differ:

```bash
cd server && cp .env.example .env     # DATABASE_URL, PORT
cd ../client && cp .env.example .env  # VITE_API_URL
cd ..
```

On PowerShell, use `Copy-Item .env.example .env` instead.

Real `.env` files are git-ignored and must never be committed.

### 4. Apply migrations and seed

```bash
cd server
npx prisma migrate dev
npx prisma db seed
```

The seed is idempotent — running it more than once will not create duplicate categories, related
systems, or Development Requesters. Stable category/system names and Requester email addresses are the
upsert keys.

### 5. Run both sides

Use two terminals:

```bash
cd server && npm run dev   # API  → http://localhost:3000
```

```bash
cd client && npm run dev   # web  → http://localhost:5173
```

Open http://localhost:5173, select an active Development Requester, and continue to My Tickets.

## Tests

```bash
npm --prefix server test   # Supertest — API endpoints
npm --prefix client test   # Vitest — UI states
npm test                    # Both server and client suites
npm run test:e2e            # Playwright — browser, responsive, accessibility, screenshots
npm run test:all            # Unit/API/UI followed by Playwright
```

Server tests reset and seed the isolated PostgreSQL schema `lab2_test`. Playwright resets and seeds
`lab2_e2e`, uses temporary Attachment storage under `.tmp/`, and starts isolated services on ports 3100
and 5174. Development data in the default `public` schema is not changed. Override the defaults with
`TEST_DATABASE_URL`, `PLAYWRIGHT_DATABASE_URL`, or `PLAYWRIGHT_ATTACHMENT_STORAGE`.

Install the browser once with `npx playwright install chromium`. On this Windows workstation Playwright
may use the installed Chrome executable; CI should install Chromium or set `PLAYWRIGHT_EXECUTABLE_PATH`.

Test files live under `server/tests/`, `client/tests/`, and `e2e/lab-02/`. Playwright screenshots are written to `artifacts/lab-02/screenshots/`.

## API

| Method | Endpoint          | Success response                                            |
| ------ | ----------------- | ----------------------------------------------------------- |
| `GET`  | `/api/health`     | `200` `{ "status": "ok", "service": "TokTickIT API" }`      |
| `GET`  | `/api/categories` | `200` `[ { "id": 1, "name": "Account and Access" }, … ]`    |

`/api/categories` returns every category as `id` and `name` only, ordered by `id`, so the list is
reproducible between calls.

`/api/health` is a liveness probe and never queries the database, so it stays `200` even while
PostgreSQL is down. `/api/categories` does read the database and answers `503`
`{ "error": "Database unavailable" }` when it cannot reach it — which is what turns the web page
Offline even though the health check itself succeeded.

## Project structure

```
toktickit/
├── client/                 React + TypeScript + Vite frontend
│   ├── src/
│   └── tests/lab-01/ and tests/lab-02/
├── server/                 Express + TypeScript API
│   ├── prisma/             schema + seed
│   ├── src/
│   └── tests/lab-01/ and tests/lab-02/
├── docs/lab-01/            tests.md · reviewer.md · ai_use.md
├── docs/lab-02/            contract, test plan, and integration evidence
├── e2e/lab-02/             Playwright integration and responsive tests
├── artifacts/lab-02/       reviewed visual evidence
├── .gitignore
└── README.md
```

## Git workflow

Lab 2 feature branches `feature/10-*` through `feature/17-*` targeted `lab2-staging`. Each feature entered
staging through a peer-reviewed PR. Issue #18 released `lab2-staging` to `main` via PR #27.
No feature development happens directly on `main` or `lab2-staging`.
