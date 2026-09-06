# Lab 2 Test Plan and Results

Status: Draft awaiting developer and peer-review approval; implementation of Issues #11–#17 pending
Contract test status: implemented in Issue #10

## 1. Test Strategy

Lab 2 follows specification-driven TDD. For each implementation Issue, add the planned test first, run it
to observe the expected failure, implement the smallest behavior, then refactor while all prior Lab 1 and
Lab 2 tests remain green.

- **Unit:** pure validation, Ticket Number generation, file inspection, and query parsing.
- **API/integration:** real Express routes with a disposable PostgreSQL test database and temporary storage.
- **UI component:** React Testing Library with user-event and mocked HTTP boundaries.
- **Style:** required classes/attributes/tokens and semantic state assertions.
- **Responsive:** Playwright viewport and overflow assertions at approved widths.
- **E2E:** browser + API + PostgreSQL + temporary file storage through complete Requester workflows.

Tests use isolated seeded records and storage directories. Time/UUID/sequence sources are controlled where
determinism matters. No required test may be skipped or depend on execution order. Cross-requester tests
must create both owners explicitly. Binary fixtures include exact 5 MB and 5 MB + 1 byte boundaries.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| DOC-01 | Unit | Issue #10 | Required docs, sections, IDs, endpoints, fixed rules, AC mappings | Contract remains complete and internally linked | `server/tests/lab-02/engineering-contract.test.ts` | Pass |
| UNIT-01 | Unit | BR-01 / AC-05 | Ticket Number format and collision retry at date/sequence boundaries | Unique `TKT-YYYYMMDD-NNNNNN` values | `server/tests/lab-02/ticket-number.test.ts` | Pass #11 |
| DB-01 | Unit / schema | Data design / DoD | Prisma models, enums, relationships, indexes, migration SQL, required seed records, and repeatable upserts | Contracted schema and duplicate-safe seed foundation | `server/tests/lab-02/data-foundation.test.ts` | Pass #11 |
| UNIT-02 | Unit | BR-09–BR-13 / AC-06 | Trimming, required values, 5/120 Summary and 10/2000 Description boundaries | Valid boundaries pass; outside values get field errors | `server/tests/lab-02/ticket-validation.test.ts` | Planned #13 |
| UNIT-03 | Unit | BR-18–BR-21 / AC-08 | Query defaults, allowlists, normalization, stable secondary sort | Valid query object or safe invalid-query result | `server/tests/lab-02/ticket-query.test.ts` | Planned #14 |
| UNIT-04 | Unit | BR-23–BR-26 / AC-12, AC-13 | Extension/MIME/signature, exact 5 MB boundary, safe storage name | Only permitted coherent files pass; UUID name generated | `server/tests/lab-02/attachment-validation.test.ts` | Planned #16 |
| API-01 | API | FR-01 / AC-01 | Active Requester collection, sort, empty and database failure | `200` active-only/empty; safe `503` | `server/tests/lab-02/requesters.api.test.ts` | Pass #12 |
| API-02 | API | FR-05 / AC-05 | Valid creation and backend-controlled owner/defaults/number | `201`; exactly one owned NEW Ticket | `server/tests/lab-02/create-ticket.api.test.ts` | Planned #13 |
| API-03 | API | FR-05 / AC-06 | Invalid fields, boundaries, inactive references/context, protected fields | `400/422`; no Ticket saved | `server/tests/lab-02/create-ticket.api.test.ts` | Planned #13 |
| API-04 | API | FR-08 / AC-08 | Ownership, search, each filter, combined filters, sort, pagination | Only owned matches with stable order/metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Planned #14 |
| API-05 | API | BR-20–BR-21 / AC-08 | Invalid queries, page/page-size boundaries, page beyond end | `400` invalid; valid empty page metadata | `server/tests/lab-02/my-tickets.api.test.ts` | Planned #14 |
| API-06 | API | FR-10–FR-11 / AC-10, AC-11 | Owned detail, malformed/missing ID, direct cross-owner access | `200` owned; same safe `404` missing/other owner | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned #15 |
| API-07 | API | FR-12–FR-14 / AC-12 | Upload/list/download permitted owned file, exact 5 MB, five active files | `201/200`; metadata and bytes match | `server/tests/lab-02/attachments.api.test.ts` | Planned #16 |
| API-08 | API | BR-23–BR-26 / AC-13 | Unsupported, mismatched, 5 MB + 1, sixth, concurrent final-slot uploads, other owner, storage failure | Safe `404/413/415/422/503`; exactly one final-slot upload; no orphan | `server/tests/lab-02/attachments.api.test.ts` | Planned #16 |
| API-09 | API | FR-15–FR-16 / AC-15, AC-16 | Valid removal, invalid reason, duplicate removal, removed download | Metadata retained; `422/409/410` as contracted | `server/tests/lab-02/attachments.api.test.ts` | Planned #16 |
| API-10 | API | BR-04, FR-18 / AC-11, AC-16 | Missing/malformed/inactive Requester context on every scoped endpoint family and cross-owner response equivalence | `400` invalid context; no existence, metadata, path, or bytes leak | `server/tests/lab-02/ownership.api.test.ts` | Planned #16 |
| UI-01 | UI | FR-01 / AC-01, AC-02 | Selector loading, ready, disabled Continue, empty, failure, testing copy | Correct state and accessible controls | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass #12 |
| UI-02 | UI | FR-02–FR-03 / AC-03 | Persist selection, shell identity, and requester-context cache/draft clearing | New identity is shown and requester-specific state does not remain; dirty-form confirmation is exercised when ticket forms exist | `client/tests/lab-02/RequesterSelection.test.tsx` | Pass #12 (current scope) |
| UI-03 | UI | FR-06 / AC-04 | All Create fields, required/read-only semantics, reference loading | Contracted labels and states render | `client/tests/lab-02/CreateTicket.test.tsx` | Planned #13 |
| UI-04 | UI | FR-07 / AC-06, AC-07 | Client validation, first-invalid focus, dirty Clear confirmation, busy duplicate prevention, failure retention | Cancel preserves values; no invalid API call; one pending call; values retained | `client/tests/lab-02/CreateTicket.test.tsx` | Planned #13 |
| UI-05 | UI | FR-05 / AC-05 | Successful create response and next actions | Official backend number shown; form resets at defined time | `client/tests/lab-02/CreateTicket.test.tsx` | Planned #13 |
| UI-06 | UI | FR-08–FR-09 / AC-08, AC-09 | Search debounce, filters, sort, page reset, URL restoration, loading/empty/no-results/failure | Correct/restorable query and distinct usable states | `client/tests/lab-02/MyTickets.test.tsx` | Planned #14 |
| UI-07 | UI | FR-10–FR-11 / AC-10, AC-11 | Read-only Detail, badges, back link, loading/not-found/failure, excluded controls | Owned fields shown; no forbidden workflow | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned #15 |
| UI-08 | UI | FR-12–FR-16 / AC-12, AC-13, AC-15, AC-16 | File selection/errors, upload, removal dialog/reason, removed state | Valid lifecycle; invalid actions blocked and announced | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned #16 |
| UI-09 | UI | BR-27 / AC-14 | One initial upload fails after Ticket creation | Partial-success warning, Ticket link, failed-file retry | `client/tests/lab-02/CreateTicket.test.tsx` | Planned #16 |
| STYLE-01 | Style | UI spec / AC-17 | Tokens/classes, labels, asterisks, `aria-*`, focus, field/button/badge states | Required visual and semantic hooks exist | `client/tests/lab-02/zen-green-style.test.tsx` | Planned #17 |
| RESP-01 | Responsive | FR-17 / AC-17 | 1440×900, 820×1180, 390×844 layouts and page scroll width | No clipping/overlap/horizontal overflow; correct table/cards | `e2e/lab-02/responsive.spec.ts` | Planned #17 |
| E2E-01 | E2E | FR-01–FR-16 / AC-01–AC-16, AC-18 | Select → create → list → detail → upload/download/remove | Complete owned flow succeeds and removed bytes are blocked | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned #17 |
| E2E-02 | E2E | FR-03, FR-11, FR-18 / AC-03, AC-11, AC-16, AC-18 | Switch A→B and attempt direct A Ticket/Attachment URLs | A data disappears; safe denial with no leak | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned #17 |
| E2E-03 | E2E | FR-17 / AC-17, AC-18 | Keyboard-only selector/create/list/detail/removal dialog | Logical focus, visible focus, operable controls | `e2e/lab-02/accessibility.spec.ts` | Planned #17 |

## 3. Acceptance-Criterion Traceability

| Acceptance criterion | Planned evidence |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | UI-01, E2E-01 |
| AC-03 | UI-02, E2E-02 |
| AC-04 | UI-03, STYLE-01 |
| AC-05 | UNIT-01, API-02, UI-05, E2E-01 |
| AC-06 | UNIT-02, API-03, UI-04 |
| AC-07 | UI-04, E2E-01 |
| AC-08 | UNIT-03, API-04, API-05, UI-06 |
| AC-09 | API-04, UI-06 |
| AC-10 | API-06, UI-07, E2E-01 |
| AC-11 | API-06, API-10, UI-07, E2E-02 |
| AC-12 | UNIT-04, API-07, UI-08, E2E-01 |
| AC-13 | UNIT-04, API-08, UI-08 |
| AC-14 | UI-09, E2E-01 |
| AC-15 | API-09, UI-08, E2E-01 |
| AC-16 | API-09, API-10, UI-08, E2E-01, E2E-02 |
| AC-17 | STYLE-01, RESP-01, E2E-03 |
| AC-18 | E2E-01, E2E-02, E2E-03 plus complete-suite output and visual checklist |

Every AC has at least one automated target. Human visual inspection supplements AC-17/AC-18 but does not
replace responsive overflow assertions.

## 4. Responsive and Visual Checklist

For each screen capture desktop 1440×900, tablet 820×1180, and mobile 390×844:

- [ ] Colors, typography, spacing, borders, and cards match `ui-spec.md`.
- [ ] Editable/read-only/invalid/focused/disabled/busy controls are distinct.
- [ ] Required markers and field-level errors remain adjacent to fields.
- [ ] Navigation, identity, primary action, filters, and pagination remain reachable.
- [ ] Desktop Ticket table and mobile cards expose equivalent identifying information.
- [ ] Priority/status badges include text and remain consistent.
- [ ] Attachment names wrap; active/uploading/invalid/removed/unavailable states remain readable.
- [ ] No clipped labels, overlapping messages, hidden actions, or page-level horizontal scrolling.
- [ ] Keyboard focus is visible and dialogs restore focus.

Store evidence in:

- `artifacts/lab-02/screenshots/create-ticket/`
- `artifacts/lab-02/screenshots/my-tickets/`
- `artifacts/lab-02/screenshots/ticket-detail/`

## 5. Test Commands

Commands run from repository root unless noted:

```powershell
# Contract and all server unit/API tests
cd server
npm test
cd ..

# UI component and style tests
cd client
npm test
cd ..

# E2E and responsive tests (after Playwright is added in Issue #17)
npx playwright test e2e/lab-02
```

Integration tests require the documented test `DATABASE_URL` and must reset/seed only the disposable test
database. E2E requires server/client processes plus a clean temporary Attachment directory.

## 6. Final Results

| Suite | Current result | Final evidence |
| --- | --- | --- |
| Engineering contract (`DOC-01`) | Pass in Issue #10 | `npm test -- --run tests/lab-02/engineering-contract.test.ts` |
| Lab 1 regression | To run before Issue #10 handoff | Attach command output to PR |
| Lab 2 unit/API | Issue #11 foundation and Issue #12 Requester API tests pass; Issues #13–#16 pending | `UNIT-01`, `DB-01`, and `API-01` pass in the full server suite |
| Lab 2 UI/style | Issue #12 selector/context and Lab 1 regression pass; Issues #13–#17 pending | `UI-01`, `UI-02`, and existing Lab 1 UI tests pass |
| Lab 2 responsive/E2E | Planned for Issue #17 | Update after implementation |

The Issue #10 PR may claim only that the contract and its structural test pass. Product completion remains
pending until Issues #11–#18 satisfy the Definition of Done.

## 7. Known Limitations or Deferred Tests

- PostgreSQL models, APIs, UI, Playwright dependency, fixtures, and product tests intentionally do not exist
  in Issue #10; their target paths are fixed here before implementation.
- Browser/assistive-technology manual checks supplement automated accessibility tests in Issue #17.
- Real authentication and penetration/security claims are deferred to Lab 3. Lab 2 tests demonstrate
  behavior under a client-selected identity, not a secure authorization boundary.
