# TokTickIT

A three-role IT service desk — CPE334 Lab 1 vertical slice. The React frontend reports live backend
status and lists the IT request categories stored in PostgreSQL.

- **Stack:** React + TypeScript + Vite + Bootstrap → Express + TypeScript → Prisma ORM → PostgreSQL
- **Tests:** Vitest (unit/UI) + Supertest (API)

## Prerequisites

- **Node.js** 18 or newer — developed on v24.13.1
- **PostgreSQL** 16 or newer, running on `localhost:5432` — developed on 18

## Setup

Every command below is written to be run from the repository root, so return there between steps.

### 1. Clone and install

```bash
git clone https://github.com/jakkarin-promsee/toktickit.git
cd toktickit
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

The seed is idempotent — running it more than once will not create duplicate categories.

### 5. Run both sides

Use two terminals:

```bash
cd server && npm run dev   # API  → http://localhost:3000
```

```bash
cd client && npm run dev   # web  → http://localhost:5173
```

Open http://localhost:5173 and click **Check System**.

## Tests

```bash
cd server && npm test   # Supertest — API endpoints
cd client && npm test   # Vitest — UI states
```

Test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

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
│   └── tests/lab-01/
├── server/                 Express + TypeScript API
│   ├── prisma/             schema + seed
│   ├── src/
│   └── tests/lab-01/
├── docs/lab-01/            tests.md · reviewer.md · ai_use.md
├── .gitignore
└── README.md
```

## Git workflow

Feature branches target `lab1-staging`; `lab1-staging` is released into `main` by pull request.
No development happens directly on `main` or `lab1-staging`, and every PR requires a peer review.

| Issue                         | Feature branch                 | PR target      |
| ----------------------------- | ------------------------------ | -------------- |
| 1. Project foundation         | `feature/1-project-foundation` | `lab1-staging` |
| 2. API health check           | `feature/2-health-check`       | `lab1-staging` |
| 3. Create and seed categories | `feature/3-category-seed`      | `lab1-staging` |
| 4. Category list              | `feature/4-category-list`      | `lab1-staging` |
