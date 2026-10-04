# Lab 3 Sprint Engineering Specification

Status: Approved engineering contract. Peer-reviewed and merged into `lab3-staging` as PR #42 before Issue #31 began; implemented by Issues #31–#40 (PRs #43–#52) and released to `main` through PR #54 on 4 October 2026. Definition of Done progress is recorded in section 10.

Issue: #30

Branch: `feature/30-lab3-engineering-contract`

## 1. Sprint Goal

Deliver secure role-based access for real Requesters, IT Staff, and Administrators while preserving the completed Lab 2 Requester workflow, adding an operational Ticket Queue and Ticket Detail workflow for IT Staff, and providing intentionally minimal Administrator user management in the established responsive Zen Green interface.

## 2. Stakeholder Request

Replace the Development Requester selector with authenticated users and backend-enforced authorization; require initial-password replacement; retain owned Requester Tickets and Attachments; let IT Staff find, own, prioritize, communicate about, and progress Tickets; let Requesters communicate and signal that a problem appears resolved; and let Administrators safely manage one-role user accounts without gaining IT Staff mutation privileges.

## 3. Scope

### Included

- Email/password login, current-user retrieval, logout, inactive-account handling, login throttling, mandatory initial-password change, secure password hashing, server-side sessions, CSRF protection, expiration, and session invalidation.
- Exactly one role per User: Requester, IT Staff, or Administrator, with role-aware navigation and backend authorization on every protected operation.
- Migration from `RequesterUser` to `User` while retaining numeric IDs, Ticket ownership, Attachment attribution/removal metadata, Categories, Related Systems, Ticket Numbers, and stored files.
- Authenticated continuation of Lab 2 Create Ticket, My Tickets, Requester Ticket Detail, reference data, Attachment upload/list/download/soft removal, validation, safe ownership failures, and responsive behavior.
- Requester and IT Staff Public Comments, Requester Problem Appears Resolved signaling, IT Staff Ticket Queue, Staff Ticket Detail, ownership claim/reassignment, IT Priority, status transitions, and Internal Notes.
- Administrator read-only visibility of Ticket Detail, Public Comments, and Internal Notes as required by visibility rules, without claim, assignment, priority, status, comment-authoring, note-authoring, or Requester actions.
- Minimal Administrator User Management for list, name/email search, optional single role filter, create, edit name/email/role/activation, and set a new initial password.
- Prisma/PostgreSQL model decisions, data-preserving migration, idempotent local seed data, exact REST contract, Zen Green UI extension, planned automated tests, traceability, review gates, and Product Definition of Done.

### Excluded

- Email invitations, password-reset email, email delivery of initial passwords or reset links, multi-factor authentication, social login, single sign-on, self-registration, Requester-created accounts, account unlocking, and Administrator approval workflows.
- Actions Taken or Service Actions, formal SLA calculation, escalation rules, notification services, dashboards or KPI analytics beyond simple queue counts, and Lab 4 resolution prerequisites.
- Multi-tenant organizations, departments, customer administration, organization management, profile photos, extended profiles, production-grade deployment changes, and cloud-infrastructure changes.
- Multiple roles per user, user deletion, bulk user operations, import or export, role history, account audit-history screens, and advanced identity-management functions.
- Mandatory pagination for the Administrator user list, multi-column Administrator sorting, and multiple simultaneous Administrator filters.
- Editing or deleting Public Comments or Internal Notes and hard deletion of Users, Tickets, Attachments, Comments, or Notes.

## 4. Functional Requirements

- FR-01 The system shall authenticate a User with a normalized email address and password and shall return only safe identity, role, password-change, session-expiration, and CSRF data.
- FR-02 A User authenticated with an initial password shall be limited to current-user, change-password, and logout operations until a valid replacement password is saved.
- FR-03 The system shall maintain revocable server-side sessions in an opaque HttpOnly cookie, enforce absolute expiration and CSRF protection, rotate the session after password change, and invalidate sessions on logout, password reset, deactivation, or role change.
- FR-04 The application shell shall display the authenticated User's name and role, provide Logout and permitted password actions, and expose navigation appropriate to exactly one role.
- FR-05 Every protected API shall enforce authentication, password-change state, role, ownership, and resource-state rules on the backend; frontend visibility is not authorization.
- FR-06 Requester operations shall derive identity only from the authenticated session and shall ignore or reject any client-supplied `requesterId` or `X-Requester-Id`.
- FR-07 Authenticated Requesters shall continue to create Tickets, list/search/filter/sort/page owned Tickets, and open owned Ticket Detail with the Lab 2 validation and safe ownership contract.
- FR-08 Authenticated Requesters shall continue to upload, list, download, preview, and soft-remove permitted Attachments on owned Tickets, while IT Staff and Administrators may list and download Attachments needed for read access to Ticket Detail.
- FR-09 Requesters shall retrieve and append Public Comments only on owned Tickets, and IT Staff shall retrieve and append Public Comments on any Ticket.
- FR-10 A Requester shall confirm a Problem Appears Resolved signal on an owned Ticket in Waiting for Requester without directly changing the Ticket to Resolved or Closed.
- FR-11 IT Staff shall retrieve a shared Ticket Queue with defined search, filters, stable sorting, pagination, ownership information, queue counts, and loading, empty, no-results, forbidden, and safe-failure states.
- FR-12 IT Staff shall open Staff Ticket Detail containing grouped Ticket data, Attachments, ownership, IT Priority, permitted status actions, Public Comments, and visually separate Internal Notes.
- FR-13 IT Staff shall claim an unassigned Ticket and assign or reassign a Ticket to one active IT Staff or Administrator User, subject to conflict and confirmation rules.
- FR-14 IT Staff shall change IT Priority independently of Requested Priority while preserving the Requester's original Requested Priority.
- FR-15 IT Staff shall update Ticket status only through the approved transition matrix, with required ownership, confirmation, concurrency, actor, and timestamp validation.
- FR-16 IT Staff shall retrieve and append Internal Notes on any Ticket; Administrators shall have read-only Internal Note visibility; Requesters shall receive no note content or existence details.
- FR-17 Public Comments and Internal Notes shall be append-only, backend-authored and backend-timestamped, validated to 1–2,000 trimmed Unicode characters, and rendered as plain text.
- FR-18 Administrators shall retrieve a User list showing name, email, one role, activation status, and Edit action, searchable by name or email with an optional single role filter.
- FR-19 Administrators shall create a User with a unique normalized email, name, exactly one permitted role, activation state, and valid initial password that must be changed at next login.
- FR-20 Administrators shall edit a User's name, email, role, and activation state while enforcing self-protection, last-active-Administrator protection, active-owner consistency, uniqueness, validation, and session revocation.
- FR-21 Administrators shall set a valid new initial password for a User, revoke that User's sessions, and require replacement at the next successful login without returning the password or hash.
- FR-22 Administrators shall not delete Users, and Administrator authorization shall not grant Ticket claim, assignment, priority, status, Public Comment creation, Internal Note creation, or Problem Appears Resolved actions.
- FR-23 The data model shall support Users, credentials, sessions, exactly one role, Ticket submitter and optional owner, IT Priority, complete status workflow, requester resolution indication, Public Comments, Internal Notes, timestamps, concurrency versions, foreign keys, and query indexes.
- FR-24 The migration shall preserve all Lab 2 records and relationships, convert existing Development Requesters into Requester Users with local initial credentials, remove client selector state, and make existing Tickets and Attachments accessible through authenticated ownership.
- FR-25 The idempotent local seed shall contain the required active and inactive Requesters and IT Staff, an active Administrator, distributed realistic Tickets, assigned and unassigned ownership, Public Comments, and non-sensitive Internal Notes.
- FR-26 The interface shall extend reusable Lab 2 Zen Green components and remain keyboard-operable, focus-visible, semantically labeled, non-color-dependent, and usable without clipping, overlap, hidden actions, or horizontal page scrolling on desktop, tablet, and mobile.
- FR-27 Every endpoint and screen shall distinguish unauthenticated, password-change-required, forbidden, invalid, missing, conflict, rate-limited, dependency, and unexpected failures with safe messages and without cross-owner, credential, stack, SQL, or storage leakage.
- FR-28 The implementation shall be verified by planned unit, schema/migration, API/integration, UI component, UI style, responsive, security/authorization, regression, accessibility, visual, and end-to-end tests mapped to every Acceptance Criterion.

## 5. Business Rules

- BR-01 Only an active User with valid credentials may authenticate.
- BR-02 A User marked as requiring a password change cannot enter the normal application until a new valid password is saved.
- BR-03 The authenticated User identity, not a `requesterId` supplied by the client, determines ownership of Requester operations.
- BR-04 Public Comments are visible to Requesters, IT Staff, and Administrators according to Ticket visibility; Internal Notes are visible only to IT Staff and Administrators.
- BR-05 A Requester may indicate that the problem appears resolved but cannot formally set the Ticket to Resolved or Closed.
- BR-06 Email addresses are trimmed, converted to lowercase, validated to a maximum of 254 characters, and stored with case-insensitive uniqueness; login failure uses one generic message for unknown email, wrong password, inactive account, or missing credential.
- BR-07 Passwords contain 12–128 characters with at least one lowercase letter, uppercase letter, digit, and symbol; leading or trailing whitespace is significant rather than silently trimmed, and a replacement password must differ from the current password.
- BR-08 Passwords are never logged, returned, or stored in plaintext; credentials use Argon2id with at least 19 MiB memory, two iterations, parallelism one, a per-password random salt, and a library-managed encoded hash.
- BR-09 Five failed logins for the same normalized email plus IP address in a rolling 15-minute window produce `429` with `Retry-After`; successful login clears that key, and the local single-process limiter never reveals whether an account exists.
- BR-10 A successful login creates a random 256-bit opaque session token, stores only its SHA-256 hash, sends the raw token in the `toktickit_session` HttpOnly, SameSite=Lax cookie with Path `/` and an eight hours absolute lifetime, and sets Secure outside local HTTP development.
- BR-11 Unsafe authenticated requests require both an allowed `Origin` and the current session's `X-CSRF-Token`; safe GET/HEAD requests do not require the header, and login requires an allowed `Origin` but no CSRF token.
- BR-12 Logout is idempotent, revokes the current session when present, clears the cookie, and leaves subsequent protected access unauthenticated; expired or revoked sessions return `401` and are not refreshed silently.
- BR-13 Deactivation, role change, Administrator initial-password reset, and successful mandatory password change revoke all prior sessions for the affected User; password change returns a newly rotated session for immediate continuation.
- BR-14 Current-user responses contain only `id`, `displayName`, `email`, `role`, `isActive`, `mustChangePassword`, `sessionExpiresAt`, and `csrfToken`; password hashes, session hashes, and other Users are never included.
- BR-15 Every User has exactly one role from `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`; unknown roles are rejected rather than coerced.
- BR-16 Role-specific navigation and hidden controls improve usability, but frontend visibility is not authorization and every protected action is rechecked by the backend.
- BR-17 A Requester may access only Tickets they submitted and Attachments belonging to those Tickets; missing and differently owned Ticket or Attachment identifiers use the same safe `404 RESOURCE_NOT_FOUND` response.
- BR-18 Lab 2 Ticket field validation, reference-data activity rules, Ticket Number generation, search, filters, stable pagination, Attachment type/size/count/signature checks, soft-removal metadata, and partial upload success remain in force unless this contract explicitly replaces the identity mechanism or initial IT Priority.
- BR-19 A Ticket may have zero or one primary owner, and a non-null owner must be an active User whose role is IT Staff or Administrator.
- BR-20 Claim succeeds only when the Ticket is unassigned and assigns the authenticated IT Staff User; an already assigned Ticket returns `409 TICKET_ALREADY_ASSIGNED`, while reassignment to a different eligible User requires explicit UI confirmation.
- BR-21 Requested Priority remains immutable after Requester submission; IT Priority initially copies Requested Priority and only IT Staff may later set it to `LOW`, `MEDIUM`, or `HIGH`.
- BR-22 Ticket statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`, displayed as New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, and Cancelled.
- BR-23 Only active IT Staff may perform status transitions, and transitions into In Progress, Waiting for Requester, or Resolved require a current eligible owner.
- BR-24 Resolved, Closed, Cancelled, and Reopened transitions require explicit confirmation; other allowed transitions apply directly after validation.
- BR-25 A transition not listed in the approved matrix returns `409 INVALID_STATUS_TRANSITION`; stale `version` returns `409 STALE_TICKET`, malformed values return `422`, and no state changes on failure.
- BR-26 Problem Appears Resolved is allowed only for the authenticated submitter while status is Waiting for Requester, requires confirmation, records `requesterResolvedAt` and `requesterResolvedByUserId`, returns `409` if already signaled or in another status, and never changes status; moving back to In Progress or Reopened clears the signal.
- BR-27 Requesters see Public Comments only on owned Tickets; IT Staff and Administrators see them on all Tickets; Requesters and IT Staff may append them, while Administrators are read-only.
- BR-28 IT Staff and Administrators may retrieve Internal Notes on all Tickets, only IT Staff may append them, and Requester requests receive `403 FORBIDDEN` without note data, counts, author identities, or existence hints.
- BR-29 Public Comments and Internal Notes cannot be edited or deleted in Lab 3, and each entry obtains its author and UTC creation timestamp from the authenticated backend context.
- BR-30 Comment and Note content is trimmed, must contain 1–2,000 Unicode characters after trimming, preserves internal line breaks, rejects empty or whitespace-only content, and is rendered as escaped plain text without HTML interpretation.
- BR-31 Administrator endpoints are limited to User Management plus read-only Ticket, Public Comment, Internal Note, and Attachment visibility explicitly granted by the authorization matrix; Administrator read-only access does not include IT Staff operations.
- BR-32 User creation requires a 2–100 character trimmed display name, valid unique normalized email, exactly one permitted role, Boolean activation state, and valid initial password; success never echoes the initial password or hash.
- BR-33 User updates use the current `version` for optimistic concurrency, reject duplicate email and invalid role/state values, and revoke sessions when email, role, or activation state changes.
- BR-34 An Administrator cannot deactivate their own account or change their own role, and no update may deactivate or remove the Administrator role from the last active Administrator; violations return `409` and leave state unchanged.
- BR-35 A User who owns any Ticket cannot be deactivated or changed to Requester until those Tickets are reassigned; an inactive or Requester User cannot become a Ticket owner.
- BR-36 Setting a new initial password requires a valid password, replaces the credential hash, sets `mustChangePassword=true`, revokes all sessions, and returns `204` without exposing credential material.
- BR-37 Users are deactivated instead of deleted, and foreign-key deletion rules restrict removal of Users, Tickets, Comments, Notes, and Attachment audit relationships.
- BR-38 Server timestamps are UTC ISO 8601 values; the UI formats them in the browser locale while retaining an accessible exact date/time label.
- BR-39 APIs use the shared safe error envelope and distinguish `401`, `403`, `404`, `409`, `422`, `429`, `500`, and `503` without exposing stack traces, SQL, hashes, tokens, filesystem paths, or another Requester's protected resource existence.
- BR-40 Staff Queue search is case-insensitive over Ticket Number, Summary, Requester display name, and Requester email; filters are Category, Related System, status, Requested Priority, IT Priority, and owner including `unassigned`, and all supplied filters combine with AND.
- BR-41 Staff Queue supports `updatedAt`, `createdAt`, `ticketNumber`, `requestedPriority`, `itPriority`, and `status` sorting, defaults to `updatedAt desc, id desc`, appends `id` in the requested direction, uses one-based pages and sizes 10, 20, or 50 with default 20, and rejects unknown, duplicate, or invalid query parameters with `400 INVALID_QUERY`.
- BR-42 User Management search is case-insensitive over display name and email, allows at most one role filter, returns all matches ordered by `displayName asc, id asc`, and does not require pagination for the local-lab data set.
- BR-43 The idempotent seed uses stable unique emails and Ticket Numbers, hashes only documented local-development credentials supplied through `LAB3_SEED_INITIAL_PASSWORD`, never contains a real password or committed secret, and safely updates required examples without duplicating them.
- BR-44 Migration renames the existing User table while retaining IDs, backfills all former Development Requesters as `REQUESTER`, creates credentials with `mustChangePassword=true`, copies Requested Priority into any previously Unassigned IT Priority, preserves all Ticket and Attachment foreign keys, and verifies record counts and ownership before removing the selector API/header/state.
- BR-45 IT Staff and Administrator Attachment access is read-only list/download access on any Ticket; Requester upload and soft-removal permissions remain limited to the authenticated submitter, and removed Attachment byte access remains blocked.
- BR-46 Every owner, IT Priority, and status mutation records the backend actor and UTC update timestamp; account audit-history screens and general audit logs remain excluded.
- BR-47 Owner, priority, status, and User mutations use an integer `version` that increments atomically so concurrent stale updates fail without overwriting newer state.
- BR-48 All completed Lab 1 and Lab 2 tests remain regression gates, except tests tied specifically to the removed Development Requester selector/header are replaced by authenticated equivalents rather than silently deleted.

### Authorization matrix

`Owned` means the authenticated Requester submitted the Ticket. `Read` grants retrieval only. Every cell is enforced on the backend in addition to UI routing and control visibility.

| Capability | Requester | IT Staff | Administrator | Unauthenticated or password-change-required |
| --- | --- | --- | --- | --- |
| Login | Public | Public | Public | Allowed with Origin validation |
| Current user, change own password, logout | Own session | Own session | Own session | Login only; otherwise denied |
| Requester Create Ticket, My Tickets, Ticket Detail | Owned | Denied | Denied | Denied |
| Requester Attachment upload or soft removal | Owned | Denied | Denied | Denied |
| Attachment metadata and active download | Owned | Read all | Read all | Denied |
| Public Comment retrieval | Owned | Read all | Read all | Denied |
| Public Comment creation | Owned | Create on all | Denied | Denied |
| Problem Appears Resolved | Owned in Waiting for Requester | Denied | Denied | Denied |
| Staff Ticket Queue and Staff Ticket Detail | Denied | Read all | Read-only all | Denied |
| Claim, assign, reassign, IT Priority, status | Denied | Allowed by rules | Denied | Denied |
| Internal Note retrieval | Denied with no data | Read all | Read all | Denied |
| Internal Note creation | Denied | Create on all | Denied | Denied |
| User list, create, edit, activate/deactivate, set initial password | Denied | Denied | Allowed by safety rules | Denied |

### Ticket status-transition matrix

Only active IT Staff may invoke these transitions. `Owner required` means the Ticket must currently have an active IT Staff or Administrator owner. Any source/target pair absent from the table is forbidden.

| From | To | Owner required | Confirmation | Validation and side effect |
| --- | --- | --- | --- | --- |
| New | Open | No | No | Records actor/time and increments version. |
| New | Cancelled | No | Yes | Records actor/time and increments version. |
| Open | In Progress | Yes | No | Records actor/time and increments version. |
| Open | Waiting for Requester | Yes | No | Records actor/time, clears any old requester-resolution signal, and increments version. |
| Open | Cancelled | No | Yes | Records actor/time and increments version. |
| In Progress | Waiting for Requester | Yes | No | Records actor/time, clears any old requester-resolution signal, and increments version. |
| In Progress | Resolved | Yes | Yes | Records actor/time and increments version; Actions Taken is not checked in Lab 3. |
| In Progress | Cancelled | Yes | Yes | Records actor/time and increments version. |
| Waiting for Requester | In Progress | Yes | No | Clears the requester-resolution signal, records actor/time, and increments version. |
| Waiting for Requester | Resolved | Yes | Yes | A requester signal may inform but does not authorize the transition; records actor/time and increments version. |
| Waiting for Requester | Cancelled | Yes | Yes | Records actor/time and increments version. |
| Resolved | Closed | Yes | Yes | Records actor/time and increments version. |
| Resolved | Reopened | No | Yes | Clears the requester-resolution signal, records actor/time, and increments version. |
| Closed | Reopened | No | Yes | Clears the requester-resolution signal, records actor/time, and increments version. |
| Cancelled | Reopened | No | Yes | Clears the requester-resolution signal, records actor/time, and increments version. |
| Reopened | In Progress | Yes | No | Records actor/time and increments version. |
| Reopened | Waiting for Requester | Yes | No | Records actor/time, clears any old requester-resolution signal, and increments version. |
| Reopened | Resolved | Yes | Yes | Records actor/time and increments version; Actions Taken is not checked in Lab 3. |
| Reopened | Cancelled | Yes | Yes | Records actor/time and increments version. |

## 6. UI Specification Summary

The normative interaction and visual contract is [`ui-spec.md`](./ui-spec.md). It extends the existing Zen Green tokens, form fields, cards, badges, buttons, tables, validation placement, focus treatment, and responsive breakpoints. The required screens are Login, mandatory Change Password, authenticated application shell, existing Requester Create Ticket/My Tickets/Ticket Detail with Public Comments and Problem Appears Resolved, Staff Ticket Queue, Staff Ticket Detail, and Administrator User Management. Each defines initial, loading/processing, validation, success, empty/no-results where relevant, forbidden, not-found, conflict, and safe-failure behavior. Desktop uses efficient tables and grouped panels, tablet permits wrapping/two-column layouts, and mobile uses stacked controls/cards without horizontal page scrolling.

## 7. Data Changes

### Models, fields, and relationships

- `User`: existing integer `id` retained; `displayName varchar(100)`; normalized unique `email varchar(254)`; `role UserRole`; `isActive boolean`; `mustChangePassword boolean`; `version integer`; `createdAt`; and `updatedAt`. One User has zero or one Credential, many Sessions, submitted Tickets, optionally owned Tickets, authored Comments/Notes, Attachment audit relations, and mutation-actor relations.
- `Credential`: `userId` as primary and restricted foreign key; `passwordHash varchar(255)`; `passwordChangedAt`; and `createdAt`. The optional one-to-one database relation permits the controlled migration interval, while active login requires a Credential.
- `Session`: UUID `id`; unique `tokenHash char(64)`; `csrfToken char(64)`; restricted `userId`; `createdAt`; `expiresAt`; nullable `revokedAt`; and `lastSeenAt`. Indexes cover `tokenHash`, `(userId, revokedAt, expiresAt)`, and `expiresAt` cleanup.
- `Ticket`: existing UUID `id`, number, submitter, classification, summary, description, Requested Priority, and timestamps retained; `itPriority` becomes `LOW|MEDIUM|HIGH`; `currentStatus` expands to all eight statuses; nullable `ownerId`; nullable `requesterResolvedAt` and `requesterResolvedByUserId`; nullable `lastStatusChangedAt` and `lastStatusChangedByUserId`; nullable `lastOwnerChangedAt` and `lastOwnerChangedByUserId`; nullable `lastPriorityChangedAt` and `lastPriorityChangedByUserId`; and `version integer` default zero.
- `PublicComment`: UUID `id`; restricted `ticketId` and `authorId`; `content varchar(2000)`; and `createdAt`. Index `(ticketId, createdAt, id)` provides deterministic chronological retrieval.
- `InternalNote`: UUID `id`; restricted `ticketId` and `authorId`; `content varchar(2000)`; and `createdAt`. Index `(ticketId, createdAt, id)` provides deterministic chronological retrieval.
- `Attachment`, `Category`, and `RelatedSystem`: existing records and behavior remain; Attachment uploader/remover foreign-key column names migrate from Requester-specific names to User names without changing values.

Enums are `UserRole(REQUESTER, IT_STAFF, ADMINISTRATOR)`, `RequestedPriority(LOW, MEDIUM, HIGH)`, `ItPriority(LOW, MEDIUM, HIGH)`, and `TicketStatus(NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED)`.

### Ticket indexes

- Retain requester indexes needed by Lab 2 after renaming `requesterId` to `submittedByUserId`: `(submittedByUserId, updatedAt, id)`, `(submittedByUserId, createdAt, id)`, and requester-plus-filter indexes.
- Add `(updatedAt, id)`, `(createdAt, id)`, `(ownerId, updatedAt, id)`, `(currentStatus, updatedAt, id)`, `(itPriority, updatedAt, id)`, `(requestedPriority, updatedAt, id)`, `(categoryId, updatedAt, id)`, and `(relatedSystemId, updatedAt, id)` for Staff Queue filters and stable order.
- Retain unique Ticket Number and indexes required for Ticket Number lookup; PostgreSQL case-insensitive text search may use `ILIKE` for the bounded local data set without introducing a search service.

### Data-preserving migration plan

1. Record pre-migration counts and ownership joins for Users, Tickets, and Attachments and back up the local development database using the documented Lab 3 setup procedure.
2. Rename `RequesterUser` to `User`, retain each integer primary key, add role/activation/password-change/version fields, and backfill every existing record as `REQUESTER` without recreating rows.
3. Rename Requester-specific Ticket and Attachment foreign-key columns to User terminology while preserving their numeric values and restricted foreign keys.
4. Create Credential and Session tables, hash `LAB3_SEED_INITIAL_PASSWORD` for each migrated User through the idempotent migration/seed runner, and set `mustChangePassword=true`; an active User without a Credential remains unable to authenticate until backfill succeeds.
5. Expand Ticket status, add owner/workflow/audit/version fields, copy each existing Requested Priority into IT Priority before removing `UNASSIGNED`, and preserve existing `NEW` statuses.
6. Create Public Comment and Internal Note tables and their indexes, apply all new indexes/constraints, and seed only stable named examples.
7. Verify post-migration counts, every Ticket-to-submitter join, every Attachment-to-Ticket/uploader/remover join, Ticket Number uniqueness, stored-file availability, and successful initial-password login/change before removing `GET /api/requesters`, `X-Requester-Id`, localStorage key `toktickit.requesterId`, selector UI, and Change Requester action.
8. Rollback uses the database backup if verification fails; the migration must never drop source rows as a recovery strategy.

### Idempotent seed plan

- Upsert at least four active and one inactive Requester, at least three active and one inactive IT Staff, and at least one active Administrator by stable `@example.test` email addresses.
- Obtain the local-only initial password from `LAB3_SEED_INITIAL_PASSWORD`, validate it against BR-07, hash it independently for each User, mark seeded Users for password change, and document the non-secret example environment variable name without committing its value.
- Upsert realistic Tickets across Requesters, all statuses, all Requested and IT Priorities, active eligible owners and null owners, with example Public Comments and non-sensitive Internal Notes.
- Repeated seed execution updates stable examples and never duplicates Users, Tickets, Comments, Notes, Categories, Related Systems, or Attachments.

## 8. API Contract

The normative endpoint, cookie, CSRF, request/response, validation, authorization, query, status, and safe-error contract is [`api-spec.md`](./api-spec.md). The API uses an opaque server-side session in the `toktickit_session` cookie, returns a per-session CSRF token through successful login/current-user/password-change responses, and requires `X-CSRF-Token` plus an allowed Origin on unsafe authenticated methods. Requester endpoints retain Lab 2 paths but no longer accept `X-Requester-Id`; Staff endpoints use `/api/staff`; Administrator endpoints use `/api/admin`. Shared errors use `{ "error": { "code", "message", "fields"? } }` and never reveal protected resource existence or secrets.

## 9. Acceptance Criteria

- AC-01 Given an active User with valid credentials and an allowed Origin, when login succeeds, then one revocable session cookie is established and safe current-user, role, expiration, password-change, and CSRF data are returned.
- AC-02 Given unknown credentials, a wrong password, an inactive account, a missing credential, or a throttled key, when login is attempted, then no session is created and the response is generic, with `429` and `Retry-After` only after the documented threshold.
- AC-03 Given a User with `mustChangePassword=true`, when login succeeds, then every normal protected route is blocked until a valid different password is saved, after which prior sessions are revoked and a rotated session enters the permitted application.
- AC-04 Given an authenticated session, when current user, CSRF, expiration, logout, expiry, revocation, bad Origin, or bad CSRF behavior is exercised, then only the documented safe data and statuses occur and access after logout/expiry/revocation is denied.
- AC-05 Given each role, when application navigation and direct APIs are requested, then only matrix-permitted screens and actions work and hidden controls are never the only authorization barrier.
- AC-06 Given a Requester and another Requester's identifier in a header, body, path, Ticket, or Attachment request, when the operation executes, then authenticated ownership controls the result and no other Requester's protected data or existence is disclosed.
- AC-07 Given existing and new Requester Tickets, when Create Ticket, My Tickets, Ticket Detail, search/filter/sort/pagination, validation, and safe failures are used after migration, then Lab 2 behavior remains correct without the Development Requester selector.
- AC-08 Given owned Attachments and migrated Attachment metadata/files, when upload/list/download/preview/soft removal and invalid/cross-owner/removed cases are exercised, then Lab 2 limits and ownership remain correct and Staff/Administrator access stays read-only.
- AC-09 Given Requester, IT Staff, and Administrator roles, when Public Comments are retrieved or created, then visibility and authoring follow the matrix, valid content is appended with backend author/time, invalid content is rejected, and HTML-like text renders inertly.
- AC-10 Given a Requester-owned Ticket in Waiting for Requester, when Problem Appears Resolved is confirmed, then the signal is recorded without a status change; repeated, wrong-status, cross-owner, Staff, or Administrator attempts fail safely.
- AC-11 Given Ticket data and queue criteria, when IT Staff search, filter, sort, and paginate the Queue, then only matching Tickets appear in stable order with accurate metadata, ownership, counts, empty/no-results distinctions, and `400` for invalid queries.
- AC-12 Given a Ticket and each role, when Staff Ticket Detail or an equivalent read-only Administrator detail is opened, then grouped fields, Attachments, Comments, Notes, editable controls, and denied controls match the authorization matrix.
- AC-13 Given an unassigned or assigned Ticket, when IT Staff claim or reassign it, then only eligible active owners are accepted, confirmations and versions are enforced, actor/time are recorded, and conflicts leave state unchanged.
- AC-14 Given Requested Priority and IT Priority, when IT Staff changes IT Priority, then Requested Priority remains unchanged, the valid IT value and actor/time/version are saved, and stale, invalid, Requester, or Administrator changes are rejected.
- AC-15 Given every row and omitted pair in the status-transition matrix, when a transition is attempted, then role, owner, confirmation, version, signal-clearing, actor/time, and failure behavior match the contract without checking Actions Taken.
- AC-16 Given a Ticket and each role, when Internal Notes are retrieved or created, then IT Staff can read/create, Administrators can read only, Requesters receive `403` with no note data or hints, and content is append-only and safely rendered.
- AC-17 Given the Administrator User Management screen, when list, name/email search, optional role filter, loading, empty/no-results, forbidden, conflict, and failure states are used, then accurate safe User data and responsive controls are shown.
- AC-18 Given valid User data, when an Administrator creates an account, then one User with one permitted role and hashed initial credential is created, `mustChangePassword=true`, and neither password nor hash is returned.
- AC-19 Given duplicate email, invalid name/email/role/password/state, or stale version, when Administrator create/edit/reset is attempted, then the documented validation/conflict occurs without partial state or credential disclosure.
- AC-20 Given self-deactivation/self-role-change, last-active-Administrator removal/deactivation, or deactivation/Requester-role change of a current Ticket owner, when an Administrator submits the edit, then `409` is returned and no state changes.
- AC-21 Given a target User, when an Administrator sets a new valid initial password or changes email/role/activation, then required sessions are revoked and the next permitted login obeys the updated state and mandatory password change.
- AC-22 Given the Lab 2 database and local seed, when migration and repeat seeding run, then record counts/IDs/relationships/files remain valid, IT Priority is backfilled, required accounts/workflow examples exist once, and migrated Users can complete initial-password login.
- AC-23 Given Login, Change Password, Requester Detail, Staff Queue, Staff Detail, User Management, and the shell at desktop, tablet, and mobile widths, when keyboard and 200% zoom checks run, then labels, focus, announcements, touch targets, role navigation, content, and actions remain usable without clipping, overlap, or horizontal page overflow.
- AC-24 Given dependency or unexpected failures on any feature family, when the failure is surfaced, then the UI preserves recoverable input, offers appropriate retry guidance, and the API returns a safe envelope without secrets, cross-owner existence, stack, SQL, or storage-path leakage.
- AC-25 Given the approved contract and implementation, when all planned automated suites and visual checks run from a clean documented environment, then every required test passes without skips and every AC has traceable evidence.
- AC-26 Given the Issue #30 deliverables, when the documentation contract test and peer reviewer checklist run, then required files, sections, continuous IDs, endpoints, decisions, AC mappings, conflicts, authorization gaps, unsafe behavior, and untestable criteria are detected before Issue #31 begins.

## 10. Definition of Done

The coding agent must not report Sprint 3 complete until every item below is true; passing Issue #30 documentation tests alone completes only the proposed-contract implementation, not the Lab 3 product. Checked items cite their evidence; unchecked items are still open and must not be claimed.

- [x] The four contract documents are internally consistent, peer-reviewed, approved, and merged into `lab3-staging` before production Issue #31 starts. Evidence: PR #42 merged before PR #43; DOC-01 in `tests.md`.
- [x] All included FR and BR behavior is implemented without excluded scope, and all changed APIs and UI behavior match the approved contract. Evidence: FR traceability in `tests.md` section 4; UI conformance fixes in `ui-spec.md` section 12.
- [ ] The data-preserving migration succeeds from a verified Lab 2 database, preserves IDs/relationships/files, and has rollback and initial-password evidence. Partially met: DB-01 proves the forward migration, preserved records and files, and initial-password credentials; rollback evidence does not exist because Prisma Migrate is forward-only, and recovery relies on restoring a pre-migration backup.
- [x] The idempotent seed can run repeatedly and produces every required account, credential, Ticket, owner, priority, status, Comment, and Note case without committed secrets. Evidence: DB-02.
- [x] Authentication, CSRF, session revocation/expiration, role checks, ownership checks, Administrator safety rules, content safety, concurrency, and safe errors have direct automated evidence. Evidence: API-01–API-13, SEC-01–SEC-03, FAIL-01, E2E-01–E2E-04.
- [x] All retained Lab 1 and Lab 2 behavior passes regression tests after replacing selector/header-specific tests with authenticated equivalents. Evidence: REG-01 and E2E-02.
- [x] Every AC maps to a passing automated test or required visual/manual evidence in `tests.md`; no required test is skipped, disabled, commented out, flaky, or unrelated. Evidence: `tests.md` sections 3 and 10.
- [x] Server unit/API/security/migration suites, client UI/style suites, production builds, and Playwright E2E/responsive/accessibility suites pass from the documented clean setup. Evidence: `tests.md` section 10, run twice on the Issue #40 branch; rerun on `lab3-staging` and final `main` under Issue #41.
- [x] Desktop, tablet, mobile, keyboard, 200% zoom, focus, clipping, overlap, badge, editable/read-only, and horizontal-overflow checks pass for every major Lab 3 screen. Evidence: RESP-01, A11Y-01, STYLE-01, and the `ui-spec.md` section 12 checklist.
- [x] Required final screenshots and complete command output are captured from the final integrated behavior and remain readable. Evidence: after release PR #54, final `main` passed `npm run test:lab3:rerun`, `npm run test:e2e:rerun`, and `npm run test:visual`, and the screenshots under `artifacts/lab-03/screenshots/` were regenerated from that run (`tests.md` section 10).
- [x] README setup, environment variables, migration, seed, credentials, run, test, storage, cleanup, and security limitations are current and contain no real secrets. Evidence: `README.md` updated in Issue #40.
- [x] Each feature PR receives peer review, comments and responses are recorded in `reviewer.md`, all features merge into `lab3-staging`, and the tested staging branch merges into `main`. Evidence: PRs #42–#53 approved and merged into `lab3-staging`, release PR #54 approved and merged into `main`, and every review, line comment, and response linked in `reviewer.md`.
- [x] Submission evidence and the one required PDF are generated from final `main`, use the required Answer Part 1–9 headings, and contain working links and readable evidence. Evidence: the submission PDF is built from final `main` using the screenshot evidence in `ui-spec.md` section 12 and the final results in `tests.md` section 10.

## 11. Assumptions and Decisions

- Opaque database-backed sessions are selected over browser-stored JWTs because logout, deactivation, role changes, and Administrator password resets require immediate revocation without exposing bearer tokens to JavaScript storage.
- SameSite=Lax is defense in depth rather than the sole CSRF control; every unsafe authenticated method also validates Origin and `X-CSRF-Token`.
- The eight hours absolute session lifetime has no sliding extension in Lab 3, which keeps expiry deterministic and testable; Remember Me is excluded.
- The failed-login limiter is an in-process local-lab control keyed by normalized email plus IP; production multi-instance rate-limit infrastructure is outside scope.
- Administrator read-only Ticket, Attachment, Public Comment, and Internal Note access satisfies the handout visibility rules while preserving separation from IT Staff mutations; Administrator read-only access shall not claim, assign, reprioritize, transition, comment, note, or signal resolution.
- Administrators remain eligible Ticket owners because the handout explicitly allows it, but ownership does not grant them IT Staff mutation rights; IT Staff must perform operational changes.
- Comment and Note length is 1–2,000 characters to support useful troubleshooting detail while bounding storage and rendering cost; plain-text rendering avoids sanitization ambiguity.
- Requester Problem Appears Resolved is limited to Waiting for Requester because that status explicitly asks for Requester input and keeps formal resolution under IT Staff control.
- Optimistic integer versions are used for mutable Tickets and Users so concurrent actions fail visibly instead of silently overwriting newer state.
- Local development may omit the cookie Secure flag only on HTTP localhost; deployed HTTPS environments must set Secure and configure the exact allowed client Origin.
- This document was treated as proposed until a human peer review approved it in PR #42; reviewer identity, comments, responses, and approvals are recorded in `reviewer.md` from GitHub evidence rather than inferred.

### Reviewer checklist

Completed during the Issue #40 final review against the implemented increment; the evidence for each item is named on its line.

- [x] Confirm all four documents agree on role permissions, especially Administrator read-only Ticket visibility and denied IT Staff mutations. Evidence: SEC-02 role matrix and the Administrator Ticket Review in `ui-spec.md` sections 2 and 7.
- [x] Confirm FR, BR, AC, endpoint, test, and traceability IDs are complete, continuous where required, and free of conflicting definitions. Evidence: DOC-01.
- [x] Confirm every status exists in the transition matrix, every allowed transition names role/owner/confirmation behavior, and every omitted transition is intentionally forbidden. Evidence: UNIT-04 and API-10.
- [x] Confirm authentication, password, session, cookie, CSRF, expiration, throttling, logout, deactivation, reset, and role-change rules are implementable and safely testable. Evidence: API-01, API-02, SEC-01, UNIT-02.
- [x] Confirm Requester cross-owner Ticket, Attachment, Comment, and resolution-signal behavior cannot disclose another Requester's resource existence. Evidence: SEC-02, API-05, API-06, E2E-02.
- [x] Confirm Administrator self-protection, last-active-Administrator protection, duplicate email, single role, current-owner consistency, and session revocation rules have direct tests. Evidence: API-13, SEC-03, E2E-04.
- [ ] Confirm migration preserves IDs, Ticket ownership, Attachment audit relationships/files, and initial-password behavior and includes repeatable seed and rollback verification. Partially met: DB-01 and DB-02 cover everything except rollback, which is not verified because migrations are forward-only.
- [x] Confirm Public Comments and Internal Notes remain distinct in storage, authorization, UI, API, tests, and safe rendering. Evidence: API-05, API-11, UI-06, E2E-03, VISUAL-01.
- [x] Confirm every AC maps to at least one planned test with a real repository target path and that final status is not marked Pass before implementation evidence exists. Evidence: `tests.md` sections 2, 3, and 10.
- [x] Confirm excluded features have not entered any normative requirement and no criterion depends on Actions Taken, email delivery, user deletion, or production infrastructure. Evidence: section 3 scope and SEC-03 (no delete route).

### Traceability sample

`FR-03` server-side session lifecycle → `BR-10` opaque cookie and eight hours expiration plus `BR-11` CSRF and `BR-13` revocation/rotation → `AC-04` session, logout, expiry, revocation, Origin, and CSRF behavior → `SEC-02` in `server/tests/lab-03/authorization.api.test.ts`.
