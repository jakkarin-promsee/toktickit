# Issue #32 requirements — Authentication foundation

Status: Implemented on `feature/32-authentication-foundation`; PR target: `lab3-staging`.

## Functional requirements

- FR-32-01: An active User may sign in using a trimmed, lowercased email and an exact password, and a successful response returns only safe current-user data.
- FR-32-02: Unknown email, wrong password, inactive User, and missing Credential produce the same generic authentication failure and do not establish a session.
- FR-32-03: Passwords use Argon2id with the approved parameters, are never returned or logged, and replacement passwords follow the 12–128 character composition rule and differ from the current password.
- FR-32-04: Successful authentication creates a random opaque session token stored only as a SHA-256 hash in the database and sends the raw value only in the `toktickit_session` HttpOnly, SameSite=Lax cookie with an eight-hour absolute expiry.
- FR-32-05: `GET /api/auth/me` returns only the safe identity, role, active state, password-change state, expiry, and current CSRF token for an active, unrevoked, unexpired session.
- FR-32-06: The authenticated application-shell endpoint requires a live session and returns `403 PASSWORD_CHANGE_REQUIRED` while `mustChangePassword` is true; only current-user, change-password, and logout remain available in that state. Issue #33 extends this gate to every existing protected Ticket and Attachment route.
- FR-32-07: Unsafe authenticated requests require the configured exact Origin and the current session CSRF token; login requires the configured Origin and logout is idempotent when no live session exists.
- FR-32-08: Change Password verifies the current password, rejects invalid or reused replacement values, atomically updates the hash, clears `mustChangePassword`, revokes prior sessions, and returns a rotated session and CSRF token.
- FR-32-09: Logout revokes the live session after CSRF validation, clears the cookie, and prevents current-user and protected-route access afterward.
- FR-32-10: The client renders Zen Green Login and mandatory Change Password screens with labels, local validation, busy state, safe failures, show-password control, password rules, and logout; the authenticated shell displays the User name, full role, Change password, and Logout.

## Test mapping

| Test ID | Automated evidence | Status |
| --- | --- | --- |
| UNIT-01 | `server/tests/lab-03/auth-validation.test.ts` | Pass |
| API-01/API-02 | `server/tests/lab-03/auth.api.test.ts` | Pass |
| UI-01 | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |

## Deliberate scope boundary

This issue establishes authentication and the minimal authenticated shell only. Requester Ticket API migration, Staff operations, Administrator management, end-to-end browser checks, visual screenshots, and complete responsive evidence remain owned by their later Lab 3 issues.
