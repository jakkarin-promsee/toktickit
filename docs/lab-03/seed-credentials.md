# Lab 3 Local Seed Credentials

These accounts and credentials are for local development only. Do not reuse a personal, institutional, or production password.

## Initial-password setup

Set `LAB3_SEED_INITIAL_PASSWORD` in `server/.env` to a local value that follows the approved policy: 12–128 characters with at least one lowercase letter, uppercase letter, digit, and symbol. The repository intentionally does not provide or commit a password value.

Run `npx prisma migrate dev` and `npx prisma db seed` from `server/`. Every User without a Credential receives an independently salted Argon2id hash of the environment-supplied value and has `mustChangePassword=true`. Running seed again does not replace an existing hash or duplicate an account.

## Seeded accounts

| Email | Role | Status |
| --- | --- | --- |
| `anan@example.test` | Requester | Active |
| `mali@example.test` | Requester | Active |
| `niran@example.test` | Requester | Active |
| `pim@example.test` | Requester | Active |
| `somchai.inactive@example.test` | Requester | Inactive |
| `narin.staff@example.test` | IT Staff | Active |
| `kanda.staff@example.test` | IT Staff | Active |
| `thep.staff@example.test` | IT Staff | Active |
| `wichai.inactive.staff@example.test` | IT Staff | Inactive |
| `araya.admin@example.test` | Administrator | Active |

The same environment-supplied initial password applies only to Users that do not already have a Credential. Inactive Users receive a hash for migration consistency but remain unable to authenticate once the authentication feature is implemented.

## Safety rules

- Never add the local password to this file, source code, seed data, screenshots, logs, test output, commits, or pull-request text.
- Keep `server/.env` untracked and replace the local value if it was disclosed.
- Seed output reports only entity counts and never prints a password or hash.
- Initial-password handling is data foundation behavior in Issue #31; login and mandatory password-change endpoints are implemented in a later Issue.
