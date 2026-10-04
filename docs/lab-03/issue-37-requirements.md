# Issue #37 requirements — Administrator User Management

Status: Implementation and automated test evidence are tracked on `feature/37-admin-user-management`; PR target: `lab3-staging`; depends on #33.

## Functional requirements

- FR-37-01: Every `/api/admin/users` endpoint shall require a live Administrator session that has completed any password change, and Requesters, IT Staff, anonymous callers, and password-change-required Administrators shall be rejected with `403` or `401` regardless of navigation.
- FR-37-02: `GET /api/admin/users` shall return all users ordered by display name then ID with only safe summary fields, support a trimmed case-insensitive `search` over name and email (maximum 120 characters) and one optional `role`, and return `400 INVALID_QUERY` for unknown, duplicate, oversized, or unsupported values.
- FR-37-03: `POST /api/admin/users` shall accept exactly `displayName`, `email`, `role`, `isActive`, and `initialPassword`, trim the name (2–100 characters), normalize the email (trim and lowercase, at most 254 characters), require one of the three roles and a Boolean active flag, and apply the 12–128 character password composition rules with field-level `422` errors.
- FR-37-04: Creation shall hash the password with Argon2id, set `mustChangePassword` to true, never return or log the password or hash, reject duplicate emails (including case and whitespace variants) with `409 EMAIL_ALREADY_EXISTS`, and create the user and credential together.
- FR-37-05: `PATCH /api/admin/users/:userId` shall require the complete editable set (`displayName`, `email`, `role`, `isActive`, `version`), apply the same field validation, and compare `version` so a stale edit returns `409 STALE_USER`.
- FR-37-06: An Administrator shall not deactivate or change the role of their own account (`409 SELF_ADMIN_CHANGE_FORBIDDEN`), and no edit shall leave the system without an active Administrator (`409 LAST_ACTIVE_ADMINISTRATOR`).
- FR-37-07: A user who owns Tickets shall not be deactivated or changed to Requester (`409 USER_OWNS_TICKETS`).
- FR-37-08: Every user edit shall run in one transaction behind a single advisory lock, so two concurrent edits cannot both remove the last active Administrator, and a failed edit shall leave all state unchanged.
- FR-37-09: Changing email, role, or active state shall revoke all of the target user's sessions, while a name-only change shall not.
- FR-37-10: `POST /api/admin/users/:userId/initial-password` shall validate the password, replace the credential hash, set `mustChangePassword` to true, revoke all of the user's sessions in one transaction, and return `204` with no body.
- FR-37-11: No user deletion, bulk, import, export, history, department, multi-role, or email-delivery endpoint or control shall exist, and deactivated users shall remain in the database.
- FR-37-12: The User Management screen shall show a list (table on desktop, cards below 768 px) with Name, Email, Role, Status, and Edit, search by name or email, a single Role filter, and Clear.
- FR-37-13: The screen shall provide separate Create user and Edit user modes, with local validation, a confirmation dialog for role or active changes that names the user and session revocation, disabled own-role and own-active controls, and a discard confirmation for a dirty form.
- FR-37-14: Set new initial password shall use a separate dialog with new and confirm fields, the rules, and the warning that all sessions will end and the user must change the password at next login, and the password shall never be displayed afterward.
- FR-37-15: The screen shall provide loading, empty, no-results, forbidden, safe-failure (with Retry), saving, success, duplicate-email, stale-version (with Reload), owner-conflict, and self-protection feedback.

## Test mapping

| Test ID | Automated evidence | Expected result |
| --- | --- | --- |
| API-12 | `server/tests/lab-03/users-admin.api.test.ts` | Authorization, CSRF, password gate, list, search, role filter, invalid queries, create happy path, normalization, duplicates, every field boundary, edit, version, deactivation, self-protection, owned Tickets, concurrent last-admin safety, initial-password reset, forced change, session revocation, and absence of delete and bulk endpoints. |
| UI-07 | `client/tests/lab-03/UserManagement.test.tsx` | List fields and states, search and filter query, create validation and success, duplicate email, discard confirmation, edit, confirmation, own-account controls, conflict mapping, stale Reload, and the initial-password dialog. |

## Scope boundary

This issue adds no user deletion, bulk operations, import or export, role or account history, departments, multiple roles, email delivery, or account recovery. The concurrent last-admin case is serialized by a lock, so the losing request receives `409 LAST_ACTIVE_ADMINISTRATOR`, or `401` if it arrives after the winner has already revoked its session. Responsive screenshots belong to #40 and E2E to #39.
