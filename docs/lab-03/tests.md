# Lab 3 Test Plan

Status: Test DD contract created before Lab 3 production implementation; automated unit, API/integration, security, migration, regression, UI component, and UI style results recorded by Issue #38; browser E2E results recorded by Issue #39; responsive, accessibility, and visual evidence recorded by Issue #40. Every planned row now has a recorded result.

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

## 2. Test matrix

Final status values: `Pass` means the listed files passed in both consecutive runs recorded in section 10 on 4 October 2026. VISUAL-01 produces screenshots for human review and passes once per evidence run on a fresh seed.

| Test ID | Type | Requirement / AC | What it verifies | Expected result | Actual automated file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| DOC-01 | Contract | Issue #30 / AC-26 | Required documents/sections, continuous FR/BR/AC IDs, endpoints, decisions, test categories, AC mappings, review and completion gates | Contract drift fails before implementation begins | `server/tests/lab-03/engineering-contract.test.ts` | Pass |
| UNIT-01 | Unit | BR-06–BR-09 / AC-02, AC-03, AC-18, AC-19 | Email normalization, password 12/128 boundaries and composition, different-current rule, Argon2id encoded hash verification, and no plaintext return/log value | Valid boundaries pass; invalid values receive safe field errors; hashes differ by salt and verify correctly | `server/tests/lab-03/auth-validation.test.ts`; API boundaries in `server/tests/lab-03/auth.api.test.ts` | Pass |
| UNIT-02 | Unit | BR-10–BR-14 / AC-01, AC-04 | Opaque token length/randomness, SHA-256 storage hash, fixed eight-hour expiration, cookie parsing, allowed Origin, and email normalization | Helpers produce deterministic contract shapes with no secret/hash leakage | `server/tests/lab-03/session.test.ts` | Pass |
| UNIT-03 | Unit | BR-40–BR-42 / AC-11, AC-17 | Staff Queue and User-list query defaults, allowlists, duplicate/unknown rejection, owner forms, stable tie-breaker, and search normalization | Valid parsed query or `400 INVALID_QUERY`; no silent coercion | `server/tests/lab-03/staff-queue.api.test.ts` (`UNIT-03 staff query parsing`); User-list query in `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| UNIT-04 | Unit | BR-22–BR-26 / AC-10, AC-15 | Every allowed and forbidden status pair, owner-required targets, confirmation metadata, signal clearing, and Requester resolution eligibility | Matrix returns the documented decision for all status pairs and separate Requester signal states | `server/tests/lab-03/staff-ticket-detail.api.test.ts` (`UNIT-04 status transition matrix`); client helper in `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UNIT-05 | Unit | BR-27–BR-30 / AC-09, AC-16 | Comment/Note trim, empty/whitespace, 1/2000 boundaries, internal line breaks, plain-text treatment, and protected client author/time fields | Valid text preserves safe content; invalid/protected fields are rejected | `server/tests/lab-03/comments-notes.api.test.ts`; `server/tests/lab-03/staff-ticket-detail.api.test.ts` (validation lives in the route, so it is verified through the API) | Pass |
| DB-01 | Schema / migration | FR-23–FR-24 / BR-43–BR-48 / AC-08, AC-22 | Lab 2 snapshot migrates with User IDs, Ticket submitters/numbers/statuses, IT Priority backfill, Attachment uploader/remover/files, enums, keys, indexes, versions, credentials, and no dropped records | Pre/post counts and joins match; migrated credentials require password change; all constraints/indexes exist | `server/tests/lab-03/data-migration.test.ts` | Pass |
| DB-02 | Schema / migration | FR-25 / BR-43 / AC-22 | Seed run twice with required active/inactive role counts, distributed statuses/priorities/owners, Comments/Notes, stable keys, and environment-supplied initial password | Second run creates no duplicates and no plaintext/real secret is committed or returned | `server/tests/lab-03/seed-data.test.ts` | Pass |
| API-01 | API / integration | FR-01 / BR-01, BR-06, BR-09–BR-10 / AC-01, AC-02 | Valid login; unknown email; wrong password; inactive account; missing credential; malformed input; disallowed Origin; five-failure threshold; Retry-After; successful reset of limiter; deactivation ends a live session | `200` cookie/safe User for valid login; generic `401`; `400` malformed; threshold `429`; no session on failure | `server/tests/lab-03/auth.api.test.ts` | Pass |
| API-02 | API / integration | FR-02–FR-03, FR-21 / BR-02, BR-07–BR-08, BR-13, BR-36 / AC-03, AC-21 | Mandatory password change, wrong current password, 11/12/128/129 boundaries, same password, atomic hash update, old-session revocation, rotated continuation, logout, and Administrator reset behavior | Normal routes blocked until valid change; new session works; all prior sessions fail; reset requires next-login change | `server/tests/lab-03/auth.api.test.ts`; reset in `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| SEC-01 | Security / authorization | FR-03, FR-27 / BR-10–BR-14, BR-39 / AC-02, AC-04, AC-24 | Cookie attributes, token hash absence from responses, allowed Origin, CSRF missing/wrong/cross-session, logout idempotence, revocation, inactive session, and safe failures | Correct `204/401/403/429/503`; no token/hash/account-existence leakage | `server/tests/lab-03/authorization.api.test.ts`; `server/tests/lab-03/auth.api.test.ts` | Pass |
| SEC-02 | Security / authorization | FR-04–FR-06, FR-22 / BR-15–BR-17, BR-27–BR-31, BR-45 / AC-05, AC-06, AC-12, AC-16 | Full role-operation matrix through direct APIs, password-change gate, forged Requester fields/header, cross-owner Ticket/Attachment/Comment paths, Administrator read-only behavior, Requester Internal Note denial, and cross-feature role change revoking a live Staff session | Only matrix-permitted operations succeed; safe `403/404` contains no protected data or existence hints | `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-03 | API / integration | FR-06–FR-07 / BR-03, BR-17–BR-18 / AC-06, AC-07 | Authenticated Requester create/list/detail, backend identity/defaults, field boundaries, search/filters/sort/pages, forged identity, cross-owner equivalence | Lab 2 behavior continues without selector/header; ownership and safe errors remain authoritative | `server/tests/lab-02/create-ticket.api.test.ts`; `server/tests/lab-02/my-tickets.api.test.ts`; `server/tests/lab-02/ticket-detail.api.test.ts`; `server/tests/lab-02/requester-context.api.test.ts`; `server/tests/lab-03/authorization.api.test.ts` | Pass |
| API-04 | API / integration | FR-08 / BR-17–BR-18, BR-45 / AC-06, AC-08 | Migrated/new Attachment list/upload/download/soft remove, type/signature, exact 5 MB boundary, cross-owner, and Staff/Admin read-only | Requester-owned lifecycle passes; Staff/Admin only read; safe `404` with no existence hint | `server/tests/lab-02/attachments.api.test.ts`; `server/tests/lab-02/attachment-validation.test.ts`; `server/tests/lab-03/authorization.api.test.ts`; `server/tests/lab-03/staff-ticket-detail.api.test.ts`; migrated files in `server/tests/lab-03/data-migration.test.ts` | Pass |
| API-05 | API / integration | FR-09, FR-17 / BR-27, BR-29–BR-30 / AC-09 | Public Comment retrieval/creation for owner Requester and IT Staff, Administrator read-only, cross-owner/missing, author/time control, boundaries, append-only shape, HTML-like text | Correct chronological safe data; only permitted authors create; invalid text/protected fields persist nothing | `server/tests/lab-03/comments-notes.api.test.ts`; `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-06 | API / integration | FR-10 / BR-05, BR-26 / AC-10 | Requester resolution signal happy path, no status change, duplicate, wrong status, cross-owner, Staff/Admin denial, stale version, actor/time, and clearing after operational transition | Only owner in Waiting for Requester records one signal; all invalid attempts leave state unchanged | `server/tests/lab-03/requester-resolution.api.test.ts`; signal clearing in `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-07 | API / integration | FR-11 / BR-40–BR-41 / AC-11 | Staff/Administrator Queue visibility, every search field/filter/sort, combined criteria, `me`/unassigned/owner, counts, pages, beyond-end, stable order, invalid queries | Matching all-Ticket results and accurate metadata/counts; `400` invalid | `server/tests/lab-03/staff-queue.api.test.ts` | Pass |
| API-08 | API / integration | FR-12, FR-16 / BR-31, BR-45 / AC-12, AC-16 | Staff full detail, Administrator read-only detail, grouped related data, Comments/Notes/Attachments, malformed/missing ID, Requester denial before lookup | Permitted roles receive exact safe shape; denied role receives no Ticket/Note data | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-09 | API / integration | FR-13 / BR-19–BR-20, BR-46–BR-47 / AC-13 | Claim unassigned, double/concurrent claim, eligible assignees, reassignment, inactive/Requester owner rejection, confirmation-facing conflict, stale version, actor/time, and Administrator mutation denial | One atomic winner; only eligible owner; correct `403/409/422`; no lost update | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-10 | API / integration | FR-14–FR-15 / BR-21–BR-25, BR-46–BR-47 / AC-14, AC-15 | IT Priority values and immutable Requested Priority; every status transition; owner prerequisites; signal clearing; stale concurrency; actor/time; Requester/Admin denial; no Actions Taken check | Only documented Staff mutations commit atomically with incremented version; all invalid pairs fail unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass |
| API-11 | API / integration | FR-16–FR-17 / BR-28–BR-30 / AC-16 | Internal Note chronological retrieval, IT Staff create, Administrator read-only, Requester forbidden before lookup, missing Ticket, text boundaries, protected author/time, HTML-like text | No note data/hints leak to Requester; valid append succeeds; invalid input persists nothing | `server/tests/lab-03/staff-ticket-detail.api.test.ts`; `server/tests/lab-03/comments-notes.api.test.ts` | Pass |
| API-12 | API / integration | FR-18 / BR-31, BR-42 / AC-17 | Administrator User listing, name/email search, optional role filter, combination/order, invalid query, and forbidden access by non-Administrator | Accurate safe UserSummary collection; `400/403` as contracted; no hashes/sessions | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| API-13 | API / integration | FR-19–FR-21 / BR-32–BR-36 / AC-18, AC-19, AC-21 | User creation, one-role assignment, normalized duplicate email, field/password boundaries, atomic Credential, full basic edit, initial password reset, version conflict, revocation, and response redaction | Valid operations succeed; duplicate email and invalid values fail safely; no partial state or credential leakage | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| SEC-03 | Security / authorization | FR-20–FR-22 / BR-34–BR-37 / AC-20, AC-21 | Administrator self-deactivation and own-role prevention, last active Administrator removal/deactivation (including concurrent edits), current owner deactivation/Requester-role conflict, User deletion absence, and non-Administrator direct calls | Safety conflicts return `409` unchanged; non-Administrator returns `403`; no delete route exists | `server/tests/lab-03/users-admin.api.test.ts` | Pass |
| FAIL-01 | API / integration | FR-27 / BR-39 / AC-24 | Forced database failure for login, current user, Requester Tickets/Comments, Staff Queue/Detail/Notes, Administrator Users, and reference data, with a redaction scan for SQL, paths, passwords, hashes, connection strings, and stack frames | Consistent safe envelope and `500/503`; no session cookie and no sensitive output | `server/tests/lab-03/safe-failures.api.test.ts` | Pass |
| UI-01 | UI component | FR-01, FR-27 / AC-01, AC-02, AC-24 | Login structure, email/password validation, Show password, busy duplicate prevention, generic failure, inactive-safe copy, rate limit message, role routing, and password-change gate routing | Accessible state and one request; no account-existence disclosure; correct destination | `client/tests/lab-03/Login.test.tsx` | Pass |
| UI-02 | UI component | FR-02–FR-04 / AC-03, AC-04 | Mandatory Change Password rules and boundaries, confirmation, different-password rule, busy, CSRF header, wrong current, safe failure, success continuation, blocked navigation, and Logout | Normal app remains blocked until success; correct safe feedback and continuation | `client/tests/lab-03/ChangePassword.test.tsx` | Pass |
| UI-03 | UI component | FR-04–FR-05 / AC-05 | Requester/Staff/Administrator navigation, full-text role badge, `aria-current`, skip link, mobile Menu `aria-expanded`/`aria-controls`/Escape focus return, Administrator Users and read-only Ticket Review, direct forbidden route with home link, and the password-change gate on every route | Only permitted destinations/actions render and route guards never expose prior User data | `client/tests/lab-03/AppShell.test.tsx` | Pass |
| UI-04 | UI component | FR-07–FR-10, FR-17 / AC-07, AC-08, AC-09, AC-10 | Requester Create Ticket without identity, My Tickets, Requester Detail Comments, safe text, Comment validation/busy/failure, conditional resolution signal confirmation/conflict/success, and absence of Internal/Staff controls | Owned interactions work; signal does not alter status; forbidden UI is absent without replacing backend tests | `client/tests/lab-03/RequesterTicketDetail.test.tsx`; `client/tests/lab-03/RequesterCreateTicket.test.tsx` | Pass |
| UI-05 | UI component | FR-11 / AC-11 | Queue controls, debounce, URL restoration/reset, counts, table/cards semantics, ownership/status/priorities, page behavior, loading/empty/no-results/forbidden/failure | Stable query and distinct accessible states with equivalent card/table data | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Pass |
| UI-06 | UI component | FR-12–FR-17 / AC-12–AC-16 | Staff Detail groups, claim/reassign, priority, next statuses, owner-disabled transitions, confirmations, stale refresh, separate Public/Internal drafts, Attachments, and safe states | Correct controls by mode; drafts persist on failure; Internal/Public distinction cannot be confused | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Pass |
| UI-07 | UI component | FR-18–FR-22 / AC-17–AC-21 | User list/search/filter/table/cards, create/edit/full validation, exactly one role, duplicate email, dirty close, version conflict, self-deactivation, last active Administrator, owner conflict, initial password reset warning, success, forbidden, and failure | Minimalist workflow is complete, safe, accessible, and retains input on recoverable errors | `client/tests/lab-03/UserManagement.test.tsx` | Pass |
| STYLE-01 | UI style | FR-26 / AC-23 | Zen Green tokens and theme activation; Bootstrap primary/outline/link/focus/checkbox mapped to green; per-value status, priority, role, and account badge classes with full text; required marker with empty alternative text; adjacent field errors; 120 px textareas and 44 px controls; amber Internal Note button and tab; color-independent tab selection; header focus ring, `aria-current` styling, and the collapsible mobile menu | Required visual/semantic hooks exist and meaning never depends on color alone | `client/tests/lab-03/zen-green-style.test.tsx`; `client/tests/lab-03/ui-components.test.tsx` | Pass |
| RESP-01 | Responsive | FR-26 / AC-23 | Login and validation, Change Password, the Requester shell and Menu, My Tickets, Create Ticket validation, Requester Detail, Staff Queue and no-results, Staff Detail with every tab and the confirmation dialog, User Management list/create/edit/reset dialog, and Administrator Ticket Review at 1440×900, 820×1180, 390×844, and 720×450 (200% zoom of a 1440 px window) | No page-level horizontal scroll and no visible control, label, heading, or badge outside the viewport; Queue/User tables at 768 px and above and equivalent cards below; Menu only below 768 px; mobile touch targets at least 44 px | `e2e/lab-03/responsive.spec.ts` | Pass |
| REG-01 | Regression | FR-06–FR-08, FR-24 / BR-18, BR-44–BR-45, BR-48 / AC-06–AC-08, AC-22 | Lab 1 references and Lab 2 Ticket Number, validation, create/list/detail, query, Attachment lifecycle, removed selector API, and migrated data under authenticated Requester | All retained behavior passes; only selector/header assumptions are replaced | `server/tests/lab-01/*.test.ts`; `server/tests/lab-02/*.test.ts`; `server/tests/lab-03/data-migration.test.ts`; `client/tests/lab-03/RequesterCreateTicket.test.tsx`; `client/tests/lab-03/RequesterTicketDetail.test.tsx` | Pass |
| A11Y-01 | Accessibility | FR-26 / AC-23 | One `h1`, no skipped heading levels, labelled controls, named buttons/tabs, unique ids, valid `aria-describedby`/`aria-labelledby`/`aria-controls` targets, and described invalid fields on every major screen and validation state; WCAG AA 4.5:1 text contrast computed in the browser; keyboard-only Login with visible focus and first-invalid focus; skip link and shell navigation; mobile Menu Escape; dialog initial focus, Tab containment, Escape, and focus restore; arrow-key tabs; User Management error descriptions and reset-dialog focus | No structural or contrast violation; logical visible focus and complete operation with no keyboard trap | `e2e/lab-03/accessibility.spec.ts`; `client/tests/lab-03/ui-components.test.tsx` | Pass |
| VISUAL-01 | Visual | FR-26 / AC-23, AC-25 | 80 screenshots of every major screen at desktop, tablet, and mobile plus loading, validation, busy, success, empty, no-results, forbidden, conflict, owner-conflict, self-protection, and failure states, and 15 before/after pairs (30 images) for the defects fixed in Issue #40, each checked for overflow when captured and reviewed against the `ui-spec.md` section 12 checklist | Readable screenshots with synthetic data only and no visible password, token, or cookie; visual review supplements rather than replaces assertions | `e2e/lab-03/visual-evidence.spec.ts` and `artifacts/lab-03/screenshots/` | Pass |
| E2E-01 | E2E | FR-01–FR-05 / AC-01–AC-05 | Valid login with shell name and role, reload keeps the session, invalid and inactive login with the same safe copy and no session, local validation, first-login user blocked in UI and API until a valid change, short-password rejection, old password refused afterwards, role-specific navigation, forbidden direct URLs, logout, and direct UI/API access blocked after logout | Complete authentication lifecycle works with real cookie/CSRF/database and safe feedback | `e2e/lab-03/authentication.spec.ts` | Pass |
| E2E-02 | E2E | FR-06–FR-10 / AC-06–AC-10 | Authenticated Requester creates a Ticket with no selector and finds it in My Tickets, posts a Public Comment, confirms Problem Appears Resolved without a status change, and is refused another Requester's Ticket, comments, and every Internal Note path through UI and direct API, including a forged `X-Requester-Id` | Owned Requester workflow succeeds with no selectable/forgeable identity or cross-owner leak | `e2e/lab-03/requester-ticket-flow.spec.ts` | Pass |
| E2E-03 | E2E | FR-11–FR-17 / AC-11–AC-16 | Queue with seeded owners/statuses, search, owner and status filters, ticket-number sort both ways, 12-Ticket pagination, no-results, open detail from the queue, claim, confirmed reassign, IT Priority, Open → In Progress → confirmed Resolved, Public Comment vs Internal Note separation seen by the Requester, Attachment download bytes, forbidden `CLOSED` jump, stale-version Refresh, and Administrator read-only direct API | Complete Staff workflow follows the matrix; public/internal content remains distinct; Admin cannot mutate | `e2e/lab-03/staff-ticket-flow.spec.ts` | Pass |
| E2E-04 | E2E | FR-18–FR-22 / AC-17–AC-21 | User list columns, search, role filter, create with one role, duplicate email kept in the form, edit name, deactivate (login then fails) and reactivate, new initial password with forced change at next login, self-deactivation blocked in UI and API, two concurrent Administrator deactivations leaving one active Administrator, and Requester/Staff blocked in UI and API | Complete minimalist administration succeeds and every safety rule is observable | `e2e/lab-03/user-administration.spec.ts` | Pass |

## 3. Acceptance Criterion traceability

| Acceptance criterion | Planned evidence |
| --- | --- |
| AC-01 | UNIT-02, API-01, UI-01, E2E-01 |
| AC-02 | UNIT-01, API-01, SEC-01, UI-01, E2E-01 |
| AC-03 | UNIT-01, API-02, UI-02, E2E-01 |
| AC-04 | UNIT-02, SEC-01, UI-02, UI-03, E2E-01 |
| AC-05 | SEC-02, UI-03, E2E-01, E2E-03, E2E-04 |
| AC-06 | SEC-02, API-03, API-04, REG-01, E2E-02 |
| AC-07 | API-03, UI-04, REG-01, E2E-02 |
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

Every AC has at least one automated target. After Issue #40, every AC has at least one passing automated test, including a passing browser E2E test for AC-01 to AC-21 and passing responsive, accessibility, style, and visual evidence for AC-23 and AC-25. Human peer review and visual inspection supplement but do not replace DOC-01, responsive, accessibility, security, or E2E assertions.

## 4. Functional Requirement traceability

| Functional requirement | Passing automated evidence | Passing browser evidence |
| --- | --- | --- |
| FR-01 Authentication | API-01, UNIT-01, UNIT-02, UI-01 | E2E-01 |
| FR-02 Initial-password gate | API-02, SEC-02, UI-02, UI-03 | E2E-01 |
| FR-03 Session lifecycle | API-02, SEC-01, UNIT-02 | E2E-01 |
| FR-04 Shell identity and navigation | UI-01, UI-03 | E2E-01 |
| FR-05 Protected API enforcement | SEC-01, SEC-02 | E2E-01 |
| FR-06 Session-derived Requester identity | SEC-02, API-03 | E2E-02 |
| FR-07 Requester Ticket continuation | API-03, UI-04, REG-01 | E2E-02 |
| FR-08 Requester Attachment continuation | API-04, REG-01, DB-01 | E2E-02 |
| FR-09 Public Comments | API-05, UI-04, UI-06 | E2E-02, E2E-03 |
| FR-10 Problem Appears Resolved | API-06, UI-04 | E2E-02 |
| FR-11 Staff Ticket Queue | UNIT-03, API-07, UI-05 | E2E-03 |
| FR-12 Staff Ticket Detail | API-08, UI-06 | E2E-03 |
| FR-13 Ownership | API-09, UI-06 | E2E-03 |
| FR-14 IT Priority | API-10, UI-06 | E2E-03 |
| FR-15 Status transitions | UNIT-04, API-10, UI-06 | E2E-03 |
| FR-16 Internal Notes | API-08, API-11, SEC-02, UI-06 | E2E-03 |
| FR-17 Append-only messages | UNIT-05, API-05, API-11 | E2E-03 |
| FR-18 User list/search/filter | API-12, UI-07 | E2E-04 |
| FR-19 User creation | API-13, UI-07 | E2E-04 |
| FR-20 User editing and safety | API-13, SEC-03, UI-07 | E2E-04 |
| FR-21 New initial password | API-02, API-13, UI-07 | E2E-04 |
| FR-22 No deletion; Admin not a Ticket operator | SEC-02, SEC-03, API-09, API-10 | E2E-03, E2E-04 |
| FR-23 Data model | DB-01 | — |
| FR-24 Migration preservation | DB-01, REG-01 | E2E-02 |
| FR-25 Idempotent seed | DB-02 | — |
| FR-26 Zen Green, responsive, accessible UI | STYLE-01, UI-03 | RESP-01, A11Y-01, VISUAL-01 |
| FR-27 Safe failure states | FAIL-01, SEC-01, UI-01, UI-02, UI-05, UI-06, UI-07 | — |
| FR-28 Verification gate | DOC-01 plus the complete-suite output in section 9 | E2E-01–E2E-04 |

## 5. End-to-end traceability examples

- `FR-03` session lifecycle → `BR-10`, `BR-11`, and `BR-13` cookie/CSRF/revocation rules → `AC-04` observable session behavior → `SEC-01` in `server/tests/lab-03/authorization.api.test.ts` and `E2E-01` in `e2e/lab-03/authentication.spec.ts`.
- `FR-15` status updates → `BR-22` through `BR-25` transition rules → `AC-15` complete matrix behavior → `UNIT-04` and `API-10` in `server/tests/lab-03/staff-ticket-detail.api.test.ts`.
- `FR-20` safe User editing → `BR-33` through `BR-35` concurrency/safety rules → `AC-20` prohibited Administrator and owner changes → `SEC-03` in `server/tests/lab-03/users-admin.api.test.ts` and `E2E-04` in `e2e/lab-03/user-administration.spec.ts`.

## 6. Security and authorization test rules

- Build the operation matrix from `specification.md` and test every allowed/denied role pairing through direct HTTP calls, including an otherwise valid CSRF token so role failures are not masked by CSRF failures.
- For Requester cross-owner equivalence, compare status, code, message, response keys, and absence of Ticket/Attachment/Comment content between a random missing ID and another Requester's real ID.
- For Internal Notes, assert Requester denial occurs before Ticket lookup and that the body contains no Note count, author, content, Ticket metadata, or existence hint.
- For login enumeration, compare unknown email, wrong password, inactive User, and missing Credential status/code/message/body shape; timing inspection is advisory in the local lab and must not claim formal side-channel resistance.
- For CSRF, cover missing Origin, disallowed Origin, missing token, wrong token, token from another Session, valid token, and safe GET without token.
- For concurrency, issue overlapping claim/status/User-edit requests with the same version and assert exactly one commit, one stale conflict, monotonic version, and no merged partial values.
- For safe failure, capture serialized responses and assert known password/token/hash/path/SQL fixture markers never appear.

## 7. Migration, regression, and isolation fixtures

The migration fixture begins with the actual Lab 2 schema plus at least two Requesters, owned Tickets, active/removed Attachments with uploader/remover metadata and temporary stored bytes, all Requested Priorities, and deterministic Ticket Numbers. Assertions record IDs/counts/joins before migration and compare them afterward, then check migrated credential state and owned Ticket/Attachment relationships.

Seed tests use a synthetic `LAB3_SEED_INITIAL_PASSWORD` generated at runtime by `server/tests/global-setup.ts`, execute seed twice, compare stable identifiers and counts, verify independently salted hashes, and inspect tracked repository content to ensure the value is not committed. Development databases and real storage paths are never used.

Lab 1 and Lab 2 suites remain enabled. Selector/header-specific tests were converted in place rather than deleted: the Lab 2 API files under `server/tests/lab-02/` now run under authenticated sessions, assert forged `requesterId`/`X-Requester-Id` values are ignored, and `requesters.api.test.ts` asserts the Development Requester selector API is gone. Client Requester regression lives in `RequesterCreateTicket.test.tsx` and `RequesterTicketDetail.test.tsx`; browser-level regression is `requester-ticket-flow.spec.ts` in Issue #39.

Isolation rules verified by Issue #38:

- `server/vitest.config.ts` forces `DATABASE_URL` to the `lab2_test` schema (or `TEST_DATABASE_URL`) and `ATTACHMENT_STORAGE` to `server/.tmp/test-attachments`, so tests never touch development data or storage.
- `server/tests/global-setup.ts` resets the test schema, applies every migration, seeds once, and deletes test storage before and after the run.
- Server test files run with `fileParallelism: false`; each Issue #38 test that mutates accounts creates its own disposable `issue38-*` User and deletes it in `afterAll`, so no test depends on another test's leftovers.
- The login limiter key includes the email, so the throttling test uses its own disposable account and cannot block other tests.
- `safe-failures.api.test.ts` replaces the Prisma client only inside its own module scope, so other files keep the real database.
- `grep -rnE "\.(skip|only|todo)\(|\bxit\(|\bxdescribe\(" server/tests client/tests` returns no matches.

E2E isolation rules added by Issue #39:

- `playwright.config.ts` points the API at the `lab3_e2e` schema and `.tmp/playwright-attachments`, starts its own API on port 3100 and client on 5174 with `reuseExistingServer: false`, and sets `CLIENT_ORIGIN` to the E2E client.
- `LAB3_SEED_INITIAL_PASSWORD` is generated per run when not supplied, so no real or committed password is used.
- `e2e/global-setup.ts` force-resets the E2E schema, seeds it, and clears `mustChangePassword` on the seeded accounts only in that schema; it refuses to run against `public`. First-login behavior uses accounts that each spec creates.
- Every spec creates its own Tickets and Users with unique names, and the concurrent Administrator test restores the seeded Administrator, so tests do not depend on order or leftovers.
- Specs use roles, labels, and accessible names, and wait with web-first assertions or `expect.poll`; there are no fixed sleeps.
- `grep -rnE "\.(skip|only|fixme)\(" e2e` returns no matches.

## 8. Responsive, accessibility, and visual checklist

For Login, Change Password, Requester Ticket Detail, Staff Queue, Staff Ticket Detail, User Management, and the role shell at 1440×900, 820×1180, and 390×844, plus 200% zoom where supported:

Completed under Issue #40; the screen-by-screen checklist with screenshot paths is `ui-spec.md` section 12.

- [x] Zen Green tokens, typography, spacing, borders, cards, and role/status/priority/account/owner badges match `ui-spec.md` (STYLE-01, VISUAL-01).
- [x] Role navigation, identity, password action, Logout, primary actions, filters, and pagination remain reachable and correctly authorized (UI-03, RESP-01, E2E-01).
- [x] Editable, read-only, invalid, focused, disabled, busy, success, warning, error, public, and internal-note states are distinguishable without color alone (STYLE-01, A11Y-01, VISUAL-01).
- [x] Labels, required markers, descriptions, counters, and field errors remain adjacent and programmatically associated (A11Y-01).
- [x] Desktop semantic tables and mobile cards expose equivalent required Queue and User information (RESP-01).
- [x] Dialog focus traps, Escape, initial focus, return focus, and first-invalid focus work with keyboard only (A11Y-01, `ui-components.test.tsx`).
- [x] Long emails, Ticket Numbers, names, Comments, Notes, and filenames wrap without clipping or page-level horizontal scrolling (RESP-01, VISUAL-01).
- [x] No overlap, covered focus, hidden required action, inaccessible menu, or unexpected focus movement occurs (RESP-01, A11Y-01).

Evidence directories are `artifacts/lab-03/screenshots/authentication/`, `staff-queue/`, `staff-ticket-detail/`, `user-management/`, `requester/` for regression evidence, and `before-after/` for the defects fixed in Issue #40.

## 9. Commands

Commands run from the repository root:

```powershell
# Full server suite: contract, unit, migration/seed, API/integration, security/authorization, safe failure, Lab 1/Lab 2 regression
npm run test:server

# Full client suite: UI component and UI style tests
npm run test:client

# Full repeatable unit/API/integration/UI suite (server then client)
npm run test:lab3

# Same suite twice in a row to check for flaky or order-dependent tests
npm run test:lab3:rerun

# Production type/build verification
npm --prefix server run build
npm --prefix client run build

# Lab 3 browser E2E, responsive, and accessibility (starts its own API on 3100 and client on 5174; skips @visual)
npm run test:e2e

# Same E2E suite twice in a row
npm run test:e2e:rerun

# Screenshot evidence on a freshly seeded schema (writes artifacts/lab-03/screenshots/)
npm run test:visual
```

The server suite needs the local PostgreSQL from the README; `TEST_DATABASE_URL` and `TEST_ATTACHMENT_STORAGE` override the default isolated schema and storage path.

## 10. Current results

| Suite | Current status | Evidence |
| --- | --- | --- |
| Issue #30 requirement baseline | Complete | `docs/lab-03/issue-30-requirements.md` |
| Issue #31 data-foundation requirements | Complete | `docs/lab-03/issue-31-requirements.md` |
| Full server suite (Lab 1, Lab 2, Lab 3) | Pass: 28 files, 163 tests, run 1 and run 2 | `npm run test:lab3:rerun` on 4 October 2026 |
| Full client suite (UI component and style) | Pass: 10 files, 80 tests, run 1 and run 2 | `npm run test:client` twice on 4 October 2026 |
| Lab 3 server files | Pass: `auth-validation` 2, `auth.api` 11, `authorization.api` 8, `comments-notes.api` 11, `data-migration` 4, `engineering-contract` 6, `requester-resolution.api` 6, `safe-failures.api` 3, `seed-data` 2, `session` 6, `staff-queue.api` 14, `staff-ticket-detail.api` 23, `users-admin.api` 19 | Same run |
| Lab 1/Lab 2 regression server files | Pass: 3 Lab 1 files with 4 tests and 12 Lab 2 files with 44 tests | Same run |
| Lab 3 client files | Pass: `AppShell` 6, `ChangePassword` 6, `Login` 8, `RequesterCreateTicket` 3, `RequesterTicketDetail` 10, `StaffTicketDetail` 11, `StaffTicketQueue` 10, `UserManagement` 13, `ui-components` 3, `zen-green-style` 10 | Same run |
| Production builds | Pass | `npm --prefix server run build`; `npm --prefix client run build` on 4 October 2026 |
| Skipped/focused tests | None | `grep` command in section 7 returns no matches |
| Browser E2E, responsive, and accessibility | Pass: 6 files, 58 tests, run 1 and run 2 (no retries, no flaky) | `npm run test:e2e:rerun` on 4 October 2026 |
| E2E files | Pass: `authentication.spec.ts` 5, `requester-ticket-flow.spec.ts` 3, `staff-ticket-flow.spec.ts` 6, `user-administration.spec.ts` 6, `responsive.spec.ts` 28, `accessibility.spec.ts` 10 | Same run |
| Visual evidence | Pass: 1 file, 9 tests; 110 screenshots (80 evidence and 30 before/after) | `npm run test:visual` on a fresh seed on 4 October 2026 |
| Peer review and approval | Pending human review | Record actual reviewer/comments/responses/approval later in `docs/lab-03/reviewer.md` |

## 11. Issue #38 coverage audit

Gaps found when comparing Issues #31–#37 tests with this matrix, and how each one was closed:

| Gap before Issue #38 | Resolution |
| --- | --- |
| `auth.api.test.ts` had 2 tests: no malformed input, Origin, rate limit, password boundaries, wrong/same password, session revocation, logout idempotence, or deactivated-session checks | Added 9 tests covering API-01/API-02 |
| `authorization.api.test.ts` had 4 tests: no CSRF variants, no full role × operation matrix, and no cross-feature test | Added CSRF/Origin matrix, direct role × operation matrix, unauthenticated family scan, and the Admin role change → Staff session revoked → Requester denied flow |
| UNIT-02 target `session.test.ts` did not exist | Created `server/tests/lab-03/session.test.ts` (6 tests) |
| FAIL-01 target `safe-failures.api.test.ts` did not exist | Created it with a failing Prisma double and a redaction scan (3 tests) |
| UNIT-03, UNIT-04, and UNIT-05 targets `query-validation.test.ts`, `status-transitions.test.ts`, and `message-validation.test.ts` did not exist; the same coverage already lived in the API files | Rows now point to the real files and named `describe` blocks instead of duplicating tests |
| API-03, API-04, and REG-01 pointed to `requester-tickets.api.test.ts`, a Lab 3 `attachments.api.test.ts`, `requester-regression.test.ts`, and `RequesterRegression.test.tsx`, none of which exist | Rows now point to the converted Lab 2 suites and the Requester client tests that actually carry the coverage |
| `Login.test.tsx` and `ChangePassword.test.tsx` had 1 test each | Added busy, single request, inactive-safe copy, rate limit, Show password, role routing, gate routing, password boundaries, server field mapping, safe failure, success continuation, and gated Logout |
| STYLE-01 target `zen-green-style.test.tsx` did not exist | Created it (5 tests) |
| No single repeatable full-suite command | Added `test:server`, `test:client`, `test:lab3`, and `test:lab3:rerun` root scripts |

Production code was not changed in Issue #38; no new test revealed a defect.

## 12. Known limitations

- Accessibility checks are project-built structure, keyboard, and computed-contrast assertions rather than a full external engine such as axe-core, so they do not cover every WCAG success criterion; screen-reader output was not verified with assistive technology.
- 200% zoom is checked by laying out at the equivalent 720×450 CSS viewport rather than by changing browser zoom.
- Empty queue, forbidden, dependency failure, and rate-limit screenshots use mocked HTTP responses and are named accordingly; their real behavior is covered by the API and UI suites.
- Last-active-Administrator and stale-User conflicts are evidenced by E2E-04 and API-13 rather than screenshots, because they need concurrent requests.
- E2E login rate limiting is not exercised in the browser because the limiter is per email and IP; it is covered by API-01.
- Playwright keeps traces and screenshots only on failure; they can contain the synthetic per-run seed password typed into the login form, which is generated at runtime and never a real credential.
- The login limiter is in-memory per server process, so its tests cover one process only; a restart clears the counter by design for the local lab.
- Login enumeration is checked by response equality only; timing is not measured and no formal side-channel resistance is claimed.
- FAIL-01 forces failures through a mocked Prisma client rather than a real database outage, and covers the session-lookup failure path for authenticated endpoints rather than every individual query inside each route.
- Attachment storage-write failure, orphan cleanup, and concurrent active-limit races are not separately exercised at the Lab 3 API level; the Lab 2 validation and lifecycle suites remain the evidence for Attachment continuity.
- Client UI tests use mocked HTTP responses; real browser/API integration is covered by the planned E2E suite.
