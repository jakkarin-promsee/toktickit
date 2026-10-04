# Issue #31 Requirements: Lab 3 User Data Foundation

Status: Requirements defined before implementation on `feature/31-lab3-user-data-foundation`

## Goal

Evolve the Lab 2 PostgreSQL and Prisma foundation into the approved Lab 3 User, credential, role, Ticket workflow, Public Comment, and Internal Note model without losing or reassigning any existing Ticket, Attachment, Category, Related System, or stored Attachment file.

## In scope

- Replace `RequesterUser` with a real `User` model while preserving existing integer IDs and submitted-Ticket relationships.
- Add exactly one `UserRole` per User, normalized unique email, activation state, mandatory-password-change state, optimistic version, timestamps, one Credential, and revocable Session records.
- Store only Argon2id password hashes and require the local initial password through `LAB3_SEED_INITIAL_PASSWORD`; never commit or log its value.
- Rename Requester-specific Ticket and Attachment foreign-key fields to User terminology while preserving their values and restricted relationships.
- Expand Ticket status, copy Requested Priority into IT Priority, add nullable eligible primary ownership, Requester resolution signal fields, mutation actor/time fields, and optimistic versioning.
- Add append-only Public Comment and Internal Note models with required Ticket, author, content, and backend creation timestamp fields.
- Add database constraints, indexes, and owner-eligibility enforcement needed by Requester lookup, Staff Queue filtering/sorting, Comments/Notes ordering, normalized email, and safe relationship integrity.
- Add a reviewable roll-forward migration that applies to both a clean database and an existing Lab 2 database without destructive row recreation.
- Extend the idempotent seed with required Users, Credentials, realistic Tickets, owners, priorities, statuses, Public Comments, and non-sensitive Internal Notes.
- Document local seeded credential setup without embedding a plaintext credential.
- Adapt the existing Lab 2 backend to the renamed Prisma model/fields so the current Requester API regression suite remains green until authenticated identity replaces the temporary header in a later Issue.

## Out of scope

- Login, logout, current-user, password-change, session middleware, CSRF middleware, authorization route guards, or any other authentication endpoint.
- Removal of `GET /api/requesters`, `X-Requester-Id`, the Development Requester selector, or client-side Requester state; these remain temporary compatibility behavior until the authentication Issue.
- Staff Queue API/UI, Ticket claim/reassignment API, IT Priority mutation API, status-transition API, Public Comment/Internal Note API/UI, Requester resolution API/UI, and Administrator User Management API/UI.
- Email delivery, password-reset email, self-registration, MFA, SSO, Actions Taken, SLA, notifications, dashboards, user deletion, multiple roles, bulk operations, import/export, or deployment infrastructure.
- PR details, review comments, commits, merges, screenshots, or final Lab 3 runtime evidence.

## Functional requirements

- FR-31-01 Prisma shall define `UserRole` with exactly `REQUESTER`, `IT_STAFF`, and `ADMINISTRATOR` and require one non-null role per User.
- FR-31-02 `User` shall retain the former Requester integer ID and contain trimmed lowercase unique email, display name, role, activation state, mandatory-password-change state, optimistic version, and timestamps.
- FR-31-03 `Credential` shall have a one-to-one restricted User relation and store only a library-managed Argon2id encoded hash plus credential timestamps.
- FR-31-04 `Session` shall support the approved future authentication contract with a unique token hash, CSRF token, User relation, creation/expiry/revocation/last-seen timestamps, and cleanup indexes without adding authentication routes in this Issue.
- FR-31-05 `Ticket.submittedByUserId` shall preserve every existing `requesterId` value, and one User shall retain all Tickets previously submitted by the corresponding Development Requester.
- FR-31-06 `Ticket.ownerId` shall be nullable and shall accept only active IT Staff or Administrator Users through database-enforced eligibility checks.
- FR-31-07 Requested Priority shall remain unchanged, every existing and new Ticket shall have IT Priority equal to Requested Priority initially, and the `UNASSIGNED` IT Priority value shall be removed after backfill.
- FR-31-08 `TicketStatus` shall contain NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, and CANCELLED, with existing Tickets remaining NEW.
- FR-31-09 Ticket shall contain Requester resolution, last status/owner/priority actor and timestamp fields, and an integer version defaulting to zero.
- FR-31-10 `PublicComment` and `InternalNote` shall contain UUID ID, restricted Ticket and author relations, content up to 2,000 characters, backend creation timestamp, deterministic retrieval indexes, and no edit/delete lifecycle fields.
- FR-31-11 Attachment uploader/remover foreign-key fields shall be renamed to User terminology without changing IDs, removal metadata, Ticket links, or stored-file names.
- FR-31-12 The migration shall normalize existing email addresses only after rejecting normalization collisions, rename rather than recreate existing identity tables/columns, backfill required values, preserve all rows, and be safe for clean and Lab 2 upgrade paths.
- FR-31-13 Database constraints shall reject unnormalized email, invalid display-name length, invalid Comment/Note content length, incomplete Attachment removal metadata, and ineligible Ticket owners.
- FR-31-14 Indexes shall support active User lookup, submitted Ticket lookup, Staff Queue date/owner/status/priority/reference sorting and filtering, Session lookup/cleanup, and chronological Comment/Note retrieval.
- FR-31-15 Seed execution shall be idempotent and shall never duplicate Users, Credentials, Tickets, Comments, Notes, Categories, or Related Systems.
- FR-31-16 Seed data shall include at least four active and one inactive Requester, three active and one inactive IT Staff, one active Administrator, realistic Tickets across Requesters/statuses/priorities/assigned and unassigned ownership, Public Comments, and non-sensitive Internal Notes.
- FR-31-17 Seed and migrated Credential creation shall require `LAB3_SEED_INITIAL_PASSWORD`, validate it against the approved password policy, hash it independently for every User missing a Credential, and leave existing Credential hashes unchanged on repeat runs.
- FR-31-18 Local credential documentation shall list seeded account emails/roles/statuses, explain the environment variable and mandatory first-login change, and state that credentials are local-development data only.
- FR-31-19 Automated tests shall prove clean migration, Lab 2 data preservation, relationship and owner constraints, password storage, repeatable seed counts/distribution, and Lab 2 database/API regression.
- FR-31-20 Existing Lab 2 endpoints shall continue using the temporary Requester context while querying the new User/submittedBy/Attachment field names, and they shall preserve their existing response shape until the authentication Issue replaces the identity mechanism.

## Acceptance criteria

- AC-31-01 The working branch is `feature/31-lab3-user-data-foundation`, begins from the merged Issue #30 contract, and contains no unrelated worktree changes.
- AC-31-02 The generated Prisma client exposes User, Credential, Session, Ticket owner/workflow fields, Public Comment, and Internal Note with exactly one UserRole per User.
- AC-31-03 Duplicate or unnormalized email and missing/multiple/invalid role values cannot produce a valid User record.
- AC-31-04 Credential rows contain Argon2id encoded hashes only, no hash equals the supplied initial password, repeat seed does not rotate existing hashes, and no plaintext or real secret appears in tracked seed/documentation content.
- AC-31-05 A clean database applies the complete migration history successfully and exposes every required table, enum, foreign key, check, trigger, and index.
- AC-31-06 A representative Lab 2 database applies the new roll-forward migration without changing User IDs, Ticket IDs/numbers/submitters, Attachment IDs/Ticket links/uploader/remover values, Categories, Related Systems, or row counts.
- AC-31-07 Every migrated Ticket keeps Requested Priority, receives matching IT Priority, remains in its existing valid status, has no owner unless explicitly seeded later, and receives version zero.
- AC-31-08 Ticket owner accepts an active IT Staff or Administrator and rejects Requester, inactive, missing, or subsequently ineligible owners without altering the Ticket.
- AC-31-09 Public Comments and Internal Notes require valid Ticket and author records, receive backend creation timestamps, enforce content limits, and sort by Ticket/creation/ID indexes.
- AC-31-10 Attachment records retain active/removed metadata and stored-file references after column/table renames, and the existing Attachment lifecycle APIs remain green.
- AC-31-11 Running seed twice produces identical stable entity counts and identifiers without duplicate Users, Credentials, Tickets, Comments, or Notes.
- AC-31-12 Seed distribution meets every required active/inactive role count and includes multiple submitters, statuses, Requested/IT Priorities, eligible owners, unassigned Tickets, Public Comments, and Internal Notes.
- AC-31-13 Existing migrated Requesters and newly seeded Users missing Credentials receive independently salted initial hashes from `LAB3_SEED_INITIAL_PASSWORD`, `mustChangePassword=true`, and no credential value is printed.
- AC-31-14 Existing Lab 1 and Lab 2 server tests pass after adapting model/field names, with no login/session route, route guard, Staff UI, Administrator UI, or other out-of-scope feature added.
- AC-31-15 English requirements, credential documentation, tests, schema, migration, seed, and compatibility changes contain no hard-wrapped prose in newly written Markdown.

## Test-first implementation checklist

- [x] Record Issue #31 scope, requirements, exclusions, migration rules, compatibility boundary, and Acceptance Criteria before implementation.
- [x] Add migration, constraint, seed, password-storage, and regression tests and observe failure against the Lab 2 schema.
- [x] Implement Prisma schema and roll-forward migration only after the new tests exist.
- [x] Implement Argon2id credential backfill, idempotent seed data, and local credential documentation.
- [x] Adapt Lab 2 backend and existing data-foundation tests to the renamed model fields without implementing authentication.
- [x] Run focused Lab 3 foundation tests, the complete server suite, client regression, and both production builds.
- [x] Audit migration safety, seed idempotency, tracked secrets, changed-file scope, Markdown structure, and hard-wrap compliance.
- [x] Leave PR details, review comments, commits, merges, and screenshots for the user's later workflow.
