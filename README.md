# TokTickIT

TokTickIT is a CPE334 service desk built with React, TypeScript, Vite, Express, Prisma, and PostgreSQL. Lab 4 adds Actions Taken, a Ticket resolution gate, and role dashboards while preserving Labs 1–3 authentication, ownership, comments, notes, attachments, queue, and user management. The interface uses the Zen Green design system across desktop, tablet, and mobile.

## Roles and workflow

- **Requester:** creates and reads owned Tickets, manages owned Attachments, posts Public Comments, reads shared Actions Taken, and may signal that a Waiting for Requester problem appears resolved. That signal is advisory; it does not formally resolve the Ticket.
- **IT Staff:** uses the shared Ticket Queue, coordinates ownership and priority, posts Public Comments and private Internal Notes, records Actions Taken, and changes Ticket status within the approved matrix.
- **Administrator:** manages users, sees Staff-style dashboard metrics and read-only Ticket Review, and manages Actions Taken. Existing Staff Ticket status, owner, priority, comment, and note writes remain IT Staff-only.

A Ticket has one primary Owner while another staff member may perform or be assigned an Action. Actions Taken record action date/time, description, result, performer, optional assignee, follow-up requirement and note, attachment notes, and status. Planned Actions may start, complete, or cancel; In Progress Actions may complete or cancel. Completion needs an active assignee and a saved Result. Formal Ticket resolution needs a qualifying Completed Action in the current workflow cycle. Action creation uses an idempotency key, and writes reject stale Action or Ticket versions.

See the [Lab 4 specification](docs/lab-04/specification.md), [API contract](docs/lab-04/api-spec.md), [UI contract](docs/lab-04/ui-spec.md), and [test traceability](docs/lab-04/tests.md) for precise rules and evidence.

## Prerequisites and setup

Install Node.js 18 or newer, PostgreSQL 16 or newer, and Chromium for Playwright (`npx playwright install chromium`). This project was developed with Node.js 24 and PostgreSQL 18. Create a PostgreSQL database and user with permission to apply the checked-in Prisma migrations.

```bash
npm install
npm --prefix server install
npm --prefix client install
```

Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`. Set `DATABASE_URL`, `CLIENT_ORIGIN`, `VITE_API_URL`, and `LAB3_SEED_INITIAL_PASSWORD` for your machine. The initial password must have 12–128 characters including lowercase, uppercase, digit, and symbol; keep it only in the ignored `.env` file. [Seed credentials](docs/lab-03/seed-credentials.md) lists the synthetic account emails and first-login behavior.

Before upgrading a database with Labs 1–3 data, take and verify a backup and read [the migration guide](docs/lab-04/actions-migration.md). From `server/`, check migration status, generate the Prisma Client, deploy the committed migrations, and seed. Do not reset a database containing data to preserve. The Lab 4 migration adds Action and workflow structures and baseline events without dropping earlier Users, Tickets, Attachments, Public Comments, or Internal Notes.

```bash
cd server
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npx prisma db seed
```

The seed is idempotent and includes all eight Ticket statuses, all priorities, assigned and unassigned Tickets, and zero, one, and multiple Actions Taken. Repeated seeding does not reset edited fixtures or credential hashes. Regenerate Prisma Client after switching branches or schema versions.

Start the API and client in separate terminals from the repository root:

```bash
npm --prefix server run dev
npm --prefix client run dev
```

The defaults are `http://localhost:3000` for the API and `http://localhost:5173` for the client. Seeded accounts must change their initial password at first login. An HttpOnly session cookie authenticates reads; state-changing requests also require a CSRF token and the configured client origin.

## Tests and isolated data

The server runner resets only the `lab2_test` schema by default. Playwright resets only `lab3_e2e` and uses temporary Attachment storage and synthetic per-run credentials. If overriding `TEST_DATABASE_URL` or `PLAYWRIGHT_DATABASE_URL`, verify that neither points to `public` or any schema with real data.

```bash
npm --prefix server run build
npm --prefix client run build
npm run test:server
npm run test:client
npm run test:e2e:lab4
npm run test:e2e:lab3
npm run test:e2e
npm run test:visual
```

Both build commands type-check their TypeScript source. `test:e2e` runs Labs 3 and 4 browser suites while excluding the separate Lab 3 visual capture. Browser tests start isolated API/client services on ports 3100 and 5174. Lab 4 screenshots are under `artifacts/lab-04/screenshots/`, indexed in [Lab 4 evidence](artifacts/lab-04/README.md). Failure traces and reports under `test-results/` and `playwright-report/` are ignored.

## Demonstration path

For a full human walkthrough with exact inputs, role changes, expected results, failure paths, and an execution log, use the [Lab 4 manual UAT script](docs/lab-04/uat.md).

1. Sign in as a Requester, inspect Dashboard and My Tickets, create a Ticket, add a Public Comment, and inspect the read-only Actions Taken area. Upload an Attachment through the approved API if demonstrating Attachment behavior. On a Waiting for Requester Ticket, signal Problem appears resolved and verify the Ticket status remains unchanged.
2. Sign in as IT Staff, compare Dashboard counts with filtered Queue views, claim the new Ticket, move to Open and In Progress, and attempt Resolved before recording completed work to see the gate.
3. Add an Action, check Follow-Up Required and enter its mandatory note, assign an active staff member, edit the Result, start and complete it. Add a separate Action and cancel it with a reason. Resolve, close, and reopen the Ticket; the earlier completion does not satisfy the new cycle.
4. Sign in as Administrator to inspect operational metrics, read-only Ticket Review, Action controls, and User Management. Verify Requesters have no Action write controls or Internal Notes.

Use synthetic accounts for screenshots. Do not capture passwords, session tokens, environment files, database dumps, or private storage paths.

## Project structure

| Path | Purpose |
| --- | --- |
| `client/src/`, `client/tests/` | React UI, shared styles, and component tests |
| `server/src/`, `server/tests/` | API, authorization, domain rules, and integration tests |
| `server/prisma/` | Schema, additive migrations, and idempotent seed |
| `e2e/lab-03/`, `e2e/lab-04/` | Browser regression and final workflow suites |
| `docs/lab-04/` | Engineering, API, UI, migration, and test contracts |
| `artifacts/lab-04/screenshots/` | Reviewable visual evidence |

`GET /api/health` remains the exact public process-liveness response `{ "status": "ok", "service": "TokTickIT API" }`. A database outage makes affected data endpoints return a safe 503 without changing that liveness response. New Action endpoints live under `/api/tickets/:ticketId/actions`; dashboards live under `/api/dashboard/requester` and `/api/dashboard/staff`. Earlier endpoint families retain their Labs 2–3 contracts except the documented Lab 4 resolution gate and dashboard filters.

## Security and recovery

Passwords are stored as Argon2id hashes and session tokens as SHA-256 hashes; neither is returned by the API. The failed-login limiter is in memory and resets when the server restarts. Local HTTP omits the session cookie's `Secure` flag; HTTPS deployment needs that flag and an exact `CLIENT_ORIGIN`. After Action writes begin, recover a failed migration with a verified backup in a separate database or a forward repair, never by dropping Action history. Real environment files, dumps, runtime attachments, and temporary browser output are git-ignored.
