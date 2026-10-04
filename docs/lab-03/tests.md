# Lab 3 Test Plan

Status: Proposed Test DD contract created before Lab 3 production implementation

Last updated: 4 October 2026

## 1. Test strategy and TDD sequence

Lab 3 uses specification-driven TDD. For each implementation Issue, create the mapped failing tests first, confirm failure for the intended missing behavior, implement the smallest compliant behavior, refactor with prior suites green, and update Final status only after recording actual output. Planned paths are binding targets and may change only through an approved cross-document contract update.

Test isolation uses disposable PostgreSQL schemas, independently hashed test passwords, controlled clocks/random values where needed, temporary Attachment storage, explicit Users for every role and activation state, and cleanup that never touches development data. Security tests must invoke direct APIs rather than inferring authorization from hidden UI. No required test may be skipped, depend on execution order, use a real password, or reuse a session across cases unless session lifecycle is the subject under test.

- Contract tests parse required files, headings, IDs, endpoints, locked decisions, coverage categories, and AC traceability.
- Unit tests cover normalization, password policy/hashing boundaries, session/token helpers, query parsing, status transitions, and Comment/Note validation.
- Schema / migration tests start from a representative Lab 2 database and verify transformed records, constraints, relationships, credential state, files, rollback evidence, and repeatable seeds.
- API / integration tests exercise Express, Prisma/PostgreSQL, session cookies, CSRF, role/ownership checks, transactions, conflicts, and safe errors.
- UI component tests use React Testing Library and user-event with mocked HTTP boundaries for structure, modes, validation, busy state, routing, feedback, and role controls.
- UI style tests assert Zen Green tokens, semantic hooks, badges, editable/read-only/internal-note distinctions, focus styles, and responsive selectors.
- Responsive, accessibility, visual, and E2E tests use Playwright against the real client/API/test database at the approved viewports.
- Regression tests retain Lab 1/Lab 2 behavior and replace only selector/header-specific expectations with authenticated equivalents.

## 2. Planned test matrix

| Test ID | Type | Requirement / AC | What it verifies | Expected result | Automated target file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| DOC-01 | Contract | Issue #30 / AC-26 | Required documents/sections, continuous FR/BR/AC IDs, endpoints, decisions, test categories, AC mappings, review and completion gates | Contract drift fails before implementation begins | `server/tests/lab-03/engineering-contract.test.ts` | Pass (6 tests, 4 October 2026) |
| UNIT-01 | Unit | BR-06–BR-09 / AC-02, AC-03, AC-18, AC-19 | Email normalization, password 12/128 boundaries and composition, different-current rule, Argon2id encoded hash verification, and no plaintext return/log value | Valid boundaries pass; invalid values receive safe field errors; hashes differ by salt and verify correctly | `server/tests/lab-03/auth-validation.test.ts` | Planned |
| UNIT-02 | Unit | BR-10–BR-14 / AC-01, AC-04 | Opaque token length/randomness, SHA-256 storage hash, CSRF value, fixed eight-hour expiration, revoked/expired checks, and safe current-user projection | Helpers produce deterministic contract shapes with no secret/hash leakage | `server/tests/lab-03/session.test.ts` | Planned |
| UNIT-03 | Unit | BR-40–BR-42 / AC-11, AC-17 | Staff Queue and User-list query defaults, allowlists, duplicate/unknown rejection, owner forms, stable tie-breaker, and search normalization | Valid parsed query or `400 INVALID_QUERY`; no silent coercion | `server/tests/lab-03/query-validation.test.ts` | Planned |
| UNIT-04 | Unit | BR-22–BR-26 / AC-10, AC-15 | Every allowed and forbidden status pair, owner-required targets, confirmation metadata, signal clearing, and Requester resolution eligibility | Matrix returns the documented decision for all status pairs and separate Requester signal states | `server/tests/lab-03/status-transitions.test.ts` | Planned |
| UNIT-05 | Unit | BR-27–BR-30 / AC-09, AC-16 | Comment/Note trim, empty/whitespace, 1/2000 boundaries, internal line breaks, plain-text treatment, and protected client author/time fields | Valid text preserves safe content; invalid/protected fields are rejected | `server/tests/lab-03/message-validation.test.ts` | Planned |
| DB-01 | Schema / migration | FR-23–FR-24 / BR-43–BR-48 / AC-08, AC-22 | Lab 2 snapshot migrates with User IDs, Ticket submitters/numbers/statuses, IT Priority backfill, Attachment uploader/remover/files, enums, keys, indexes, versions, credentials, and no dropped records | Pre/post counts and joins match; migrated credentials require password change; all constraints/indexes exist | `server/tests/lab-03/data-migration.test.ts` | Pass #31 |
| DB-02 | Schema / migration | FR-25 / BR-43 / AC-22 | Seed run twice with required active/inactive role counts, distributed statuses/priorities/owners, Comments/Notes, stable keys, and environment-supplied initial password | Second run creates no duplicates and no plaintext/real secret is committed or returned | `server/tests/lab-03/seed-data.test.ts` | Pass #31 |
| API-01 | API / integration | FR-01 / BR-01, BR-06, BR-09–BR-10 / AC-01, AC-02 | Valid login; unknown email; wrong password; inactive account; missing credential; malformed input; five-failure threshold; Retry-After; successful reset of limiter | `200` cookie/safe User for valid login; generic `401`; threshold `429`; no session on failure | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API / integration | FR-02–FR-03, FR-21 / BR-02, BR-07–BR-08, BR-13, BR-36 / AC-03, AC-21 | Mandatory/voluntary password change, wrong current password, boundaries, same password, atomic hash update, old-session revocation, rotated continuation, and Administrator reset behavior | Normal routes blocked until valid change; new session works; all prior sessions fail; reset requires next-login change | `server/tests/lab-03/auth.api.test.ts` | Planned |
| SEC-01 | Security / authorization | FR-03, FR-27 / BR-10–BR-14, BR-39 / AC-02, AC-04, AC-24 | Cookie attributes, token hash absence from responses, allowed Origin, CSRF missing/wrong/cross-session, absolute expiry, logout idempotence, revocation, inactive session, and safe failures | Correct `204/401/403/429/500/503`; no token/hash/account-existence leakage | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-02 | Security / authorization | FR-04–FR-06, FR-22 / BR-15–BR-17, BR-27–BR-31, BR-45 / AC-05, AC-06, AC-12, AC-16 | Full role-operation matrix through direct APIs, password-change gate, forged Requester fields/header, cross-owner Ticket/Attachment/Comment paths, Administrator read-only behavior, and Requester Internal Note denial | Only matrix-permitted operations succeed; safe `403/404` contains no protected data or existence hints | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-03 | API / integration | FR-06–FR-07 / BR-03, BR-17–BR-18 / AC-06, AC-07 | Authenticated Requester create/list/detail, backend identity/defaults, field boundaries, active references, search/filters/sort/pages, malformed forged identity, cross-owner equivalence, and dependency failure | Lab 2 behavior continues without selector/header; ownership and safe errors remain authoritative | `server/tests/lab-03/requester-tickets.api.test.ts` | Planned |
| API-04 | API / integration | FR-08 / BR-17–BR-18, BR-45 / AC-06, AC-08 | Migrated/new Attachment list/upload/download/preview/soft remove, type/signature, exact 5 MB, active limit/concurrency, cross-owner, removed bytes, Staff/Admin read-only, storage failure, and orphan cleanup | Requester-owned lifecycle passes; Staff/Admin only read; safe `404/410/413/415/422/503`; no orphan | `server/tests/lab-03/attachments.api.test.ts` | Planned |
| API-05 | API / integration | FR-09, FR-17 / BR-27, BR-29–BR-30 / AC-09 | Public Comment retrieval/creation for owner Requester and IT Staff, Administrator read-only, cross-owner/missing, author/time control, boundaries, append-only shape, HTML-like text, and failed write | Correct chronological safe data; only permitted authors create; invalid text/protected fields persist nothing | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-06 | API / integration | FR-10 / BR-05, BR-26 / AC-10 | Requester resolution signal happy path, no status change, duplicate, wrong status, cross-owner, Staff/Admin denial, stale version, actor/time, and clearing after operational transition | Only owner in Waiting for Requester records one signal; all invalid attempts leave state unchanged | `server/tests/lab-03/requester-resolution.api.test.ts` | Planned |
| API-07 | API / integration | FR-11 / BR-40–BR-41 / AC-11 | Staff/Administrator Queue visibility, every search field/filter/sort, combined criteria, `me`/unassigned/owner, counts, pages, beyond-end, stable order, invalid queries, and failure | Matching all-Ticket results and accurate metadata/counts; `400` invalid; safe dependency errors | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-08 | API / integration | FR-12, FR-16 / BR-31, BR-45 / AC-12, AC-16 | Staff full detail, Administrator read-only detail, grouped related data, Comments/Notes/Attachments, malformed/missing ID, Requester denial before lookup, and dependency failure | Permitted roles receive exact safe shape; denied role receives no Ticket/Note data | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-09 | API / integration | FR-13 / BR-19–BR-20, BR-46–BR-47 / AC-13 | Claim unassigned, double/concurrent claim, eligible assignees, reassignment, inactive/Requester owner rejection, confirmation-facing conflict, stale version, actor/time, and Administrator mutation denial | One atomic winner; only eligible owner; correct `403/409/422`; no lost update | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-10 | API / integration | FR-14–FR-15 / BR-21–BR-25, BR-46–BR-47 / AC-14, AC-15 | IT Priority values and immutable Requested Priority; every status transition; owner prerequisites; signal clearing; stale concurrency; actor/time; Requester/Admin denial; no Actions Taken check | Only documented Staff mutations commit atomically with incremented version; all invalid pairs fail unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-11 | API / integration | FR-16–FR-17 / BR-28–BR-30 / AC-16 | Internal Note chronological retrieval, IT Staff create, Administrator read-only, Requester/non-Administrator forbidden before lookup, missing Ticket, text boundaries, protected author/time, HTML-like text, and failure | No note data/hints leak to Requester; valid append succeeds; invalid/failure persists nothing | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-12 | API / integration | FR-18 / BR-31, BR-42 / AC-17 | Administrator User listing, name/email search, optional role filter, combination/order, empty/no-results, invalid query, safe failure, and forbidden access by non-Administrator | Accurate safe UserSummary collection; `400/403/500/503` as contracted; no hashes/sessions | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-13 | API / integration | FR-19–FR-21 / BR-32–BR-36 / AC-18, AC-19, AC-21 | User creation, one-role assignment, normalized duplicate email, field/password boundaries, atomic Credential, full basic edit, initial password reset, version conflict, revocation, and response redaction | Valid operations succeed; duplicate email and invalid values fail safely; no partial state or credential leakage | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| SEC-03 | Security / authorization | FR-20–FR-22 / BR-34–BR-37 / AC-20, AC-21 | Administrator self-deactivation and own-role prevention, last active Administrator removal/deactivation, current owner deactivation/Requester-role conflict, User deletion absence, and non-Administrator direct calls | Safety conflicts return `409` unchanged; non-Administrator returns `403`; no delete route exists | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| FAIL-01 | API / integration | FR-27 / BR-39 / AC-24 | Forced database/storage/unexpected failures in every endpoint family and redaction scan for stack, SQL, paths, hashes, tokens, and protected data | Consistent safe envelope and correct `500/503`; no partial mutation or sensitive output | `server/tests/lab-03/safe-failures.api.test.ts` | Planned |
| UI-01 | UI component | FR-01, FR-27 / AC-01, AC-02, AC-24 | Login structure, email/password validation, Show password, busy duplicate prevention, generic failure, inactive-safe copy, rate limit countdown, safe failure, and role routing | Accessible state and one request; no account-existence disclosure; correct destination | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | UI component | FR-02–FR-04 / AC-03, AC-04 | Mandatory/voluntary Change Password rules, confirmation, first-invalid focus, busy, wrong current, success rotation, blocked navigation, failure retention, and Logout | Normal app remains blocked until success; correct safe feedback and continuation | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | UI component | FR-04–FR-05 / AC-05 | Requester/Staff/Administrator navigation, identity and role, password action, mobile menu, direct forbidden route, session check, logout cleanup, and cached-data clearing | Only permitted destinations/actions render and route guards never expose prior User data | `client/tests/lab-03/AppShell.test.tsx` | Planned |
| UI-04 | UI component | FR-08–FR-10, FR-17 / AC-08, AC-09, AC-10 | Requester Detail Comments, safe text, Comment validation/busy/failure, conditional resolution signal explanation/confirmation/conflict/success, Attachments, and absence of Internal/Staff controls | Owned interactions work; signal does not alter status; forbidden UI is absent without replacing backend tests | `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Planned |
| UI-05 | UI component | FR-11 / AC-11 | Queue controls, debounce, URL restoration/reset, counts, table/cards semantics, ownership/status/priorities, page behavior, loading/empty/no-results/forbidden/failure, and Administrator read-only banner | Stable query and distinct accessible states with equivalent card/table data | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-06 | UI component | FR-12–FR-17 / AC-12–AC-16 | Staff Detail groups, claim/reassign, priority, next statuses, owner-disabled transitions, confirmations, stale refresh, separate Public/Internal drafts, Attachments, Admin read-only mode, and safe states | Correct controls by mode; drafts persist on failure; Internal/Public distinction cannot be confused | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-07 | UI component | FR-18–FR-22 / AC-17–AC-21 | User list/search/filter/table/cards, create/edit/full validation, exactly one role, duplicate email, dirty close, version conflict, self-deactivation, last active Administrator, owner conflict, initial password reset warning, success, forbidden, and failure | Minimalist workflow is complete, safe, accessible, and retains input on recoverable errors | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| STYLE-01 | UI style | FR-26 / AC-23 | Zen Green tokens, Note tokens, roles/status/priorities/account/owner badges, focus selector, fields, read-only values, buttons/callouts/dialogs, and table/card responsive hooks | Required visual/semantic hooks exist and meaning never depends on color alone | `client/tests/lab-03/zen-green-style.test.tsx` | Planned |
| RESP-01 | Responsive | FR-26 / AC-23 | Login, Change Password, Requester Detail, Queue, Staff Detail, User Management, and shell at 1440×900, 820×1180, and 390×844 plus 200% zoom | No page overflow, clipping, overlap, covered focus, hidden action, or information loss across table/card changes | `e2e/lab-03/responsive.spec.ts` | Planned |
| REG-01 | Regression | FR-06–FR-08, FR-24 / BR-18, BR-44–BR-45, BR-48 / AC-06–AC-08, AC-22 | Lab 1 references and Lab 2 Ticket Number, validation, create/list/detail, query, Attachment lifecycle, partial upload, safe ownership, and migrated data under authenticated Requester | All retained behavior passes; only selector/header assumptions are replaced | `server/tests/lab-03/requester-regression.test.ts` and `client/tests/lab-03/RequesterRegression.test.tsx` | Planned |
| A11Y-01 | Accessibility | FR-26 / AC-23 | Keyboard-only login, password change, queue/detail actions, dialogs, Comments/Notes, user panels, heading order, labels, errors/live regions, focus restore, and 200% zoom | Logical visible focus and complete operation with no keyboard trap or inaccessible feedback | `e2e/lab-03/accessibility.spec.ts` | Planned |
| VISUAL-01 | Visual | FR-26 / AC-23, AC-25 | Named required screen states and three viewport captures with checklist review for design, role navigation, badges, editable/read-only, validation, focus, clipping, overlap, and overflow | Readable approved screenshots match `ui-spec.md`; visual review supplements rather than replaces assertions | `e2e/lab-03/visual-evidence.spec.ts` and `artifacts/lab-03/screenshots/` | Planned |
| E2E-01 | E2E | FR-01–FR-05 / AC-01–AC-05 | Valid/invalid/inactive/rate-limited login, mandatory first login change, role home, session reload, voluntary change, logout, and blocked direct access afterward | Complete authentication lifecycle works with real cookie/CSRF/database and safe feedback | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | FR-06–FR-10 / AC-06–AC-10 | Migrated Requester login, create/find/open Ticket, Comment, Attachment lifecycle, resolution signal, cross-owner direct URL/API, and removed selector/state | Owned Requester workflow succeeds with no selectable/forgeable identity or cross-owner leak | `e2e/lab-03/requester-ticket-flow.spec.ts` | Planned |
| E2E-03 | E2E | FR-11–FR-17 / AC-11–AC-16 | Queue search/filter/sort/page, open unassigned Ticket, claim/reassign, IT Priority, permitted statuses, Public Comment, Internal Note, Attachments, stale conflict, and Administrator read-only review | Complete Staff workflow follows matrix; public/internal content remains distinct; Admin cannot mutate | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-04 | E2E | FR-18–FR-22 / AC-17–AC-21 | User list/search/filter, create, duplicate email, invalid values, edit, exactly one role, activate/deactivate, initial password reset/change, self-deactivation, last active Administrator, owner conflict, and non-Administrator access | Complete minimalist administration succeeds and every safety rule is observable | `e2e/lab-03/user-administration.spec.ts` | Planned |

## 3. Acceptance Criterion traceability

| Acceptance criterion | Planned evidence |
| --- | --- |
| AC-01 | UNIT-02, API-01, UI-01, E2E-01 |
| AC-02 | UNIT-01, API-01, SEC-01, UI-01, E2E-01 |
| AC-03 | UNIT-01, API-02, UI-02, E2E-01 |
| AC-04 | UNIT-02, SEC-01, UI-02, UI-03, E2E-01 |
| AC-05 | SEC-02, UI-03, E2E-01, E2E-03, E2E-04 |
| AC-06 | SEC-02, API-03, API-04, REG-01, E2E-02 |
| AC-07 | API-03, REG-01, E2E-02 |
| AC-08 | DB-01, API-04, UI-04, REG-01, E2E-02 |
| AC-09 | UNIT-05, API-05, UI-04, UI-06, E2E-02, E2E-03 |
| AC-10 | UNIT-04, API-06, UI-04, E2E-02 |
| AC-11 | UNIT-03, API-07, UI-05, E2E-03 |
| AC-12 | SEC-02, API-08, UI-06, E2E-03 |
| AC-13 | API-09, UI-06, E2E-03 |
| AC-14 | API-10, UI-06, E2E-03 |
| AC-15 | UNIT-04, API-10, UI-06, E2E-03 |
| AC-16 | UNIT-05, SEC-02, API-08, API-11, UI-06, E2E-03 |
| AC-17 | UNIT-03, API-12, UI-07, E2E-04 |
| AC-18 | UNIT-01, API-13, UI-07, E2E-04 |
| AC-19 | UNIT-01, API-13, UI-07, E2E-04 |
| AC-20 | SEC-03, UI-07, E2E-04 |
| AC-21 | API-02, API-13, SEC-03, UI-07, E2E-04 |
| AC-22 | DB-01, DB-02, REG-01, E2E-02 |
| AC-23 | STYLE-01, RESP-01, A11Y-01, VISUAL-01 |
| AC-24 | SEC-01, FAIL-01, UI-01, UI-02, UI-04, UI-05, UI-06, UI-07 |
| AC-25 | REG-01, RESP-01, A11Y-01, VISUAL-01, E2E-01, E2E-02, E2E-03, E2E-04 plus complete-suite output |
| AC-26 | DOC-01 plus the human Reviewer checklist in `specification.md` |

Every AC has at least one automated target. Human peer review and visual inspection supplement but do not replace DOC-01, responsive, accessibility, security, or E2E assertions.

## 4. End-to-end traceability examples

- `FR-03` session lifecycle → `BR-10`, `BR-11`, and `BR-13` cookie/CSRF/revocation rules → `AC-04` observable session behavior → `SEC-01` in `server/tests/lab-03/authorization.api.test.ts` and `E2E-01` in `e2e/lab-03/authentication.spec.ts`.
- `FR-15` status updates → `BR-22` through `BR-25` transition rules → `AC-15` complete matrix behavior → `UNIT-04` in `server/tests/lab-03/status-transitions.test.ts` and `API-10` in `server/tests/lab-03/staff-ticket-detail.api.test.ts`.
- `FR-20` safe User editing → `BR-33` through `BR-35` concurrency/safety rules → `AC-20` prohibited Administrator and owner changes → `SEC-03` in `server/tests/lab-03/users-admin.api.test.ts` and `E2E-04` in `e2e/lab-03/user-administration.spec.ts`.

## 5. Security and authorization test rules

- Build the operation matrix from `specification.md` and test every allowed/denied role pairing through direct HTTP calls, including an otherwise valid CSRF token so role failures are not masked by CSRF failures.
- For Requester cross-owner equivalence, compare status, code, message, response keys, and absence of Ticket/Attachment/Comment content between a random missing ID and another Requester's real ID.
- For Internal Notes, assert Requester denial occurs before Ticket lookup and that body/log capture contains no Note count, author, content, Ticket metadata, or existence hint.
- For login enumeration, compare unknown email, wrong password, inactive User, and missing Credential status/code/message/body shape; timing inspection is advisory in the local lab and must not claim formal side-channel resistance.
- For CSRF, cover missing Origin, disallowed Origin, missing token, wrong token, token from another Session, valid token, and safe GET without token.
- For concurrency, issue overlapping claim/status/User-edit requests with the same version and assert exactly one commit, one stale conflict, monotonic version, and no merged partial values.
- For safe failure, capture serialized responses and assert known password/token/hash/path/SQL fixture markers never appear.

## 6. Migration and regression fixtures

The migration fixture begins with the actual Lab 2 schema plus at least two Requesters, owned Tickets, active/removed Attachments with uploader/remover metadata and temporary stored bytes, all Requested Priorities, and deterministic Ticket Numbers. Assertions record IDs/counts/joins before migration and compare them afterward, then perform migrated initial-password login/change and owned Ticket/Attachment access.

Seed tests set `LAB3_SEED_INITIAL_PASSWORD` to a synthetic valid value at runtime, execute seed twice, compare stable identifiers and counts, verify independently salted hashes, and inspect tracked repository content to ensure the value is not committed. Development databases and real storage paths are never used.

Lab 1 and Lab 2 suites remain enabled. Selector/header-specific tests are not merely deleted: their ownership and context intent is replaced in `requester-regression.test.ts`, `RequesterRegression.test.tsx`, and `requester-ticket-flow.spec.ts` using authenticated sessions and forged-identity rejection.

## 7. Responsive, accessibility, and visual checklist

For Login, Change Password, Requester Ticket Detail, Staff Queue, Staff Ticket Detail, User Management, and the role shell at 1440×900, 820×1180, and 390×844, plus 200% zoom where supported:

- [ ] Zen Green tokens, typography, spacing, borders, cards, and role/status/priority/account/owner badges match `ui-spec.md`.
- [ ] Role navigation, identity, password action, Logout, primary actions, filters, and pagination remain reachable and correctly authorized.
- [ ] Editable, read-only, invalid, focused, disabled, busy, success, warning, error, public, and internal-note states are distinguishable without color alone.
- [ ] Labels, required markers, descriptions, counters, and field errors remain adjacent and programmatically associated.
- [ ] Desktop semantic tables and mobile cards expose equivalent required Queue and User information.
- [ ] Dialog focus traps, Escape, initial focus, return focus, live announcements, and first-invalid focus work with keyboard only.
- [ ] Long emails, Ticket Numbers, names, Comments, Notes, and filenames wrap without clipping or page-level horizontal scrolling.
- [ ] No overlap, covered focus, hidden required action, inaccessible menu, or unexpected focus movement occurs.

Evidence directories are `artifacts/lab-03/screenshots/authentication/`, `staff-queue/`, `staff-ticket-detail/`, `user-management/`, and optional `requester/` for regression evidence.

## 8. Planned commands

Commands run from the repository root after their mapped implementation exists:

```powershell
# Documentation contract and all server unit/API/security/migration/regression tests
npm --prefix server test

# UI component/style and client regression tests
npm --prefix client test

# Lab 3 E2E, responsive, accessibility, and visual evidence after the root script is extended by the implementation Issue
npx playwright test e2e/lab-03

# Production type/build verification
npm --prefix server run build
npm --prefix client run build
```

The current root `test:e2e` script targets Lab 2 and must not be claimed as Lab 3 evidence until a later implementation Issue deliberately extends it; Issue #30 does not modify runtime scripts.

## 9. Current results

| Suite | Current status | Evidence |
| --- | --- | --- |
| Issue #30 requirement baseline | Complete | `docs/lab-03/issue-30-requirements.md` |
| Issue #31 data-foundation requirements | Complete | `docs/lab-03/issue-31-requirements.md` |
| Engineering contract (`DOC-01`) | Pass: 1 file, 6 tests | `npm --prefix server test -- --run tests/lab-03/engineering-contract.test.ts` on 4 October 2026 |
| Issue #31 migration and repeatable seed | Pass: 2 files, 6 tests | `npm --prefix server test -- --run tests/lab-03/data-migration.test.ts tests/lab-03/seed-data.test.ts` on 4 October 2026 |
| Complete server regression through Issue #31 | Pass: 18 files, 86 tests | `npm --prefix server test` on 4 October 2026 |
| Existing client regression through Issue #31 | Pass: 7 files, 33 tests | `npm --prefix client test` on 4 October 2026 |
| Existing server and client production builds through Issue #31 | Pass | `npm --prefix server run build`; `npm --prefix client run build` on 4 October 2026 |
| Unit, schema/migration, API/integration, security, and regression | Planned | Production implementation is explicitly outside Issue #30 |
| UI component and style | Planned | Production implementation is explicitly outside Issue #30 |
| Responsive, accessibility, visual, and E2E | Planned | Production implementation is explicitly outside Issue #30 |
| Peer review and approval | Pending human review | Record actual reviewer/comments/responses/approval later in `docs/lab-03/reviewer.md` |

No future feature test is marked Pass before its code and evidence exist. Issue #30 completion establishes a proposed, machine-checked contract; it does not claim the Lab 3 product is complete.
