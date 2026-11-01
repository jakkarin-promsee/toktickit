# Lab 4 Test DD and Traceability Plan

Status: Mixed. Issue #57 established this plan before implementation; Issue #61 dashboard rows now record executed evidence, while remaining `Planned` rows are not claims of completion. The approved Labs 1–3 suites remain regression gates.

## 1. Test method and environment

Use the repository's Vitest API/client suites and Playwright E2E suite against a disposable PostgreSQL schema seeded with synthetic `example.test` users. Freeze or inject a server UTC clock for boundary tests; never infer dashboard windows from the browser clock. Run migration tests from a representative Lab 3 database snapshot with Users, Tickets, Attachments, Public Comments, and Internal Notes, including a legacy Resolved Ticket and a zero-action Ticket. Use two authenticated sessions for stale-write collisions. Test direct API bypass as well as UI hiding. For endpoint tests, assert response code/body, database row/event counts, unchanged state on failure, and no secret/cross-owner data. For visual tests, inspect desktop 1440×900, tablet 820×1180, mobile 390×844, and 200% zoom.

`npm run test` executes the current server/client Vitest suites and will include Lab 4 test files once added. Run `npx playwright test e2e/lab-04` for the new E2E suite when the local PostgreSQL test environment is available; the current `npm run test:e2e` script targets only `e2e/lab-03` and remains the prior-lab regression command until a later implementation issue updates it. Final commands and output must be recorded after running them; this plan does not fabricate execution. No production code or tests are created by Issue #57.

## 2. Planned tests

| Test ID | Type | AC | Scenario and expected result | Target test file | Status |
| --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit/validation | AC-02 | Action date bounds, ISO offsets, Unicode field lengths, required Result, conditional Follow-Up Note, and protected-key rejection produce exact field errors. | `server/tests/lab-04/action-validation.test.ts` | Planned |
| UNIT-02 | Unit/workflow | AC-04 | All Action matrix edges are accepted and omitted/terminal edges denied; assignee and cancellation prerequisites are applied. | `server/tests/lab-04/action-transitions.test.ts` | Planned |
| UNIT-03 | Unit/workflow | AC-08, AC-09 | All 64 Ticket matrix pairs, owner checks, current-cycle Completed Action gate, and legacy already-Resolved exception match the specification. | `server/tests/lab-04/ticket-transition-rules.test.ts` | Planned |
| UNIT-04 | Unit/dashboard | AC-12, AC-13 | UTC midnight, exact start/end instants, overlap of cards, zeros, and stable tie-break ordering yield documented formulas. | `server/tests/lab-04/dashboard-calculations.test.ts` | Planned |
| API-01 | API/integration | AC-01 | Create one Action with distinct Owner/Performer/Assignee, backend identity, UTC times, Action and parent Ticket version/updated time, events, and identical-key replay after a later Ticket version without duplication. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-02 | API/validation | AC-02, AC-19 | Direct invalid Action bodies and protected actor/audit/status fields fail safely with no row/event writes. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-03 | API/authorization | AC-03, AC-06 | Assign/reassign eligible staff/admin, reject inactive/ineligible assignee, preserve Ticket Owner, and deny Requester writes. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-04 | API/lifecycle | AC-04 | Edit, Planned → In Progress, direct Planned → Completed, In Progress → Completed, and both Cancelled paths set audit fields/events; forbidden/terminal cases leave rows unchanged. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-05 | API/visibility | AC-05, AC-06 | Requester reads every own Action in stable order with shared fields only; cross-owner/missing are identical 404; Staff/Admin see allowed audit detail. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-06 | API/concurrency | AC-07, AC-19 | Two sessions collide on Action and parent Ticket versions; only one write/event commits, stale response uses the safe error envelope, and authorized GET obtains fresh versions. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| API-07 | API/workflow | AC-08 | Every allowed Ticket transition and denied pair checks role, Owner, required `confirmed: true` and missing/false `422`, signal clearing, actor/time/version, and event append. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-08 | API/resolution | AC-09 | Zero Action, Planned, In Progress, Cancelled, pre-Reopened Completed, and wrong-Ticket Completed block Resolved; current-cycle Completed permits it; legacy Resolved can close. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-09 | API/resolution/concurrency | AC-07, AC-09 | Concurrent Action completion and Ticket resolution use an atomic gate and stale conflict; no partial status/event change. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-10 | API/requester | AC-10 | Owned Waiting Requester signal records advisory actor/time only, repeats/wrong status/cross-owner/other roles fail, and formal resolution remains Staff-only. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-11 | API/history | AC-11 | Action and Ticket event sequences are append-only and ordered; baseline has null actor and never claims an invented transition. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| API-12 | API/dashboard | AC-12 | Requester cards/recent/attention match direct owner-filtered database counts at UTC boundaries, include zeros, and never include another owner. | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass |
| API-13 | API/dashboard | AC-13 | Staff/Admin cards, eight status and three priority buckets, current-user Actions, recent/urgent lists, ties, zeros, and multi-action Ticket counts match database queries. | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass |
| API-14 | API/filters | AC-12, AC-13, AC-14 | Dashboard fixed-window drill-down views match card predicates; invalid/duplicate/incompatible query parameters return 400. | `server/tests/lab-04/dashboard-filters.api.test.ts` | Pass |
| API-15 | API/security | AC-06, AC-14, AC-19 | Requester Staff dashboard/Action mutation, Administrator existing Staff Ticket mutation, wrong Owner, forced actor fields, and CSRF/Origin bypass fail before protected data lookup. | `server/tests/lab-04/authorization.api.test.ts` | Planned |
| API-16 | API/safe failure | AC-14, AC-19 | DB outage and unexpected error use safe 503/500 envelope, no partial writes, secret/SQL/stack/storage leakage, or cached cross-role payload. | `server/tests/lab-04/safe-failures.api.test.ts` | Planned |
| DATA-01 | Migration | AC-11, AC-17 | Run migration on Lab 3 snapshot, compare all five entity counts/joins and Ticket fields, confirm zero-action reads and one truthful baseline per Ticket. | `server/tests/lab-04/data-migration.test.ts` | Planned |
| DATA-02 | Seed/recovery | AC-13, AC-17 | Run seed/baseline twice, verify stable counts/IDs, all statuses/priorities and zero/one/multiple Actions, then rehearse backup restoration on a disposable copy. | `server/tests/lab-04/seed-data.test.ts` | Planned |
| UI-01 | Component | AC-05, AC-15 | Action list order, Owner/Performer/Assignee labels, Requester all-item read-only view, Staff/Admin controls, and terminal read-only states render correctly. | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-02 | Component/form | AC-02, AC-03, AC-04, AC-15 | Create, assign/reassign, edit, start, direct complete, cancel, conditional note, inactive assignee, validation focus, and repeat-click guard work. | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-03 | Component/failure | AC-07, AC-15, AC-19 | Loading/empty/success/forbidden/not-found/stale/500 states preserve recoverable drafts and require explicit refresh, not silent retry. | `client/tests/lab-04/ActionsTaken.test.tsx` | Planned |
| UI-04 | Component/workflow | AC-08, AC-09, AC-10, AC-15 | Ticket controls reflect matrix/Owner/gate, confirmations, blocked resolution, Requester advisory signal, success refresh, and baseline history label. | `client/tests/lab-04/TicketWorkflow.test.tsx` | Planned |
| UI-05 | Component/dashboard | AC-12, AC-14, AC-16 | Requester cards/lists, owned direct links, fixed-window filter URLs, zero/loading/forbidden/safe-failure states, and role shell render correctly. | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pass |
| UI-06 | Component/dashboard | AC-13, AC-14, AC-16 | Staff/Admin cards, buckets, current-user Actions, recent/urgent links, zeros/failures, and Administrator read-only Ticket context render correctly. | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass |
| STYLE-01 | UI style | AC-15, AC-16 | Zen Green tokens, text status cues, shared/private labels, field errors, focus outline, and Action terminal/read-only styles remain consistent. | `client/tests/lab-04/zen-green-style.test.tsx` | Planned |
| RESP-01 | Responsive | AC-15, AC-16 | Dashboard/Action/workflow screens at 1440×900, 820×1180, 390×844 and 200% zoom have no page overflow, clipped controls, or overlap. | `e2e/lab-04/responsive.spec.ts` | Planned |
| A11Y-01 | Accessibility | AC-15, AC-16 | Keyboard order, card/Action links, menu, dialog trap/Escape/focus return, labels, live announcements, 44 px targets, and noncolor cues work. | `e2e/lab-04/accessibility.spec.ts` | Planned |
| E2E-01 | End-to-end | AC-01, AC-03, AC-04, AC-05, AC-15 | Distinct staff members on one Ticket create/assign/edit/start/complete/cancel Actions; Requester sees all shared items and no writes. | `e2e/lab-04/actions-taken-flow.spec.ts` | Planned |
| E2E-02 | End-to-end | AC-08, AC-09, AC-10, AC-11 | Ticket runs New → Open → In Progress → Resolved → Closed → Reopened; zero-action/post-reopen gate, Requester signal, history, and stale feedback behave correctly. | `e2e/lab-04/ticket-resolution.spec.ts` | Planned |
| E2E-03 | End-to-end | AC-12, AC-13, AC-14, AC-16 | Requester/Staff/Admin dashboards show seeded counts and direct drill-down, zero/loading/failure states, ownership isolation, and responsive navigation. | `e2e/lab-04/dashboards.spec.ts` | Pass |
| HEALTH-01 | Health/API | AC-18, AC-19 | `/api/health` keeps its exact Lab 1 `200` process-liveness body even during a DB outage; affected data endpoints return safe `503` without protected data. | `server/tests/lab-04/health.test.ts` | Planned |
| PERF-01 | Performance smoke | AC-13, AC-18 | With a documented local dataset of at least 1,000 Tickets and 5,000 Actions, dashboard endpoints use bounded summaries and finish under 2 seconds at p95 over 30 local requests; report environment and actual timings, not a release SLA. | `server/tests/lab-04/dashboard-performance.test.ts` | Planned |
| REG-01 | Labs 1–3 regression | AC-18, AC-19 | Existing authentication, CSRF, ownership, Ticket, Attachment, Comment, Note, Staff Queue/detail, User Management, safe-failure, and health suites pass unchanged except documented Lab 4 gate updates. | `server/tests/lab-03/engineering-contract.test.ts`, `server/tests/lab-03/authorization.api.test.ts`, `server/tests/lab-02/engineering-contract.test.ts`, `server/tests/lab-01/health.test.ts` | Pass |
| REG-02 | Labs 1–3 UI/E2E regression | AC-16, AC-18 | Existing Requester/Staff/Admin flows, responsive, accessibility, and visual evidence remain usable after Action/dashboard additions. | `e2e/lab-03/requester-ticket-flow.spec.ts`, `e2e/lab-03/staff-ticket-flow.spec.ts`, `e2e/lab-03/user-administration.spec.ts`, `e2e/lab-03/accessibility.spec.ts`, `e2e/lab-03/responsive.spec.ts` | Planned |
| DOC-01 | Contract audit | AC-20 | Four docs have 11 required sections, continuous FR/BR/AC IDs, complete matrices, consistent shapes/endpoints, and every AC maps to a test/file; peer review records gaps/responses. | `server/tests/lab-04/engineering-contract.test.ts` | Planned |

## 3. Acceptance-criterion coverage index

| AC | Planned test IDs |
| --- | --- |
| AC-01 | API-01, E2E-01 |
| AC-02 | UNIT-01, API-02, UI-02 |
| AC-03 | API-03, UI-02, E2E-01 |
| AC-04 | UNIT-02, API-04, UI-02, E2E-01 |
| AC-05 | API-05, UI-01, E2E-01 |
| AC-06 | API-03, API-05, API-15, UI-01 |
| AC-07 | API-06, API-09, UI-03 |
| AC-08 | UNIT-03, API-07, UI-04, E2E-02 |
| AC-09 | UNIT-03, API-08, API-09, UI-04, E2E-02 |
| AC-10 | API-10, UI-04, E2E-02 |
| AC-11 | API-11, DATA-01, E2E-02 |
| AC-12 | UNIT-04, API-12, API-14, UI-05, E2E-03 |
| AC-13 | UNIT-04, API-13, API-14, DATA-02, UI-06, E2E-03, PERF-01 |
| AC-14 | API-14, API-16, UI-05, UI-06, E2E-03 |
| AC-15 | UI-01, UI-02, UI-03, UI-04, STYLE-01, RESP-01, A11Y-01, E2E-01 |
| AC-16 | UI-05, UI-06, STYLE-01, RESP-01, A11Y-01, E2E-03, REG-02 |
| AC-17 | DATA-01, DATA-02 |
| AC-18 | HEALTH-01, PERF-01, REG-01, REG-02 |
| AC-19 | API-02, API-06, API-15, API-16, UI-03, HEALTH-01, REG-01 |
| AC-20 | DOC-01 |

Traceability sample: `FR-07` → `BR-19` → `AC-09` → `API-08` in `server/tests/lab-04/ticket-workflow.api.test.ts`. The issue-required example may also be checked through `API-09` for the concurrency case.

## 4. Evidence and exit rules

The implementation issues must replace each Planned status with Pass/Fail/Blocked only after running the named test, record the actual command and environment, and link any required screenshots or test logs. A skipped or missing test cannot be marked Pass. Direct database query examples must accompany dashboard API tests to prove formulas; migration evidence must include pre/post counts and joins; performance smoke must report dataset size, machine, timing, and any instability. Independent review of the engineering contract must explicitly challenge the Action lifecycle, role matrix, resolution gate, dashboard calculations, and AC testability and record actual PR comments/responses before the main implementation PRs finish.

### Issue #61 dashboard evidence (2026-10-31)

- The Requester API test compares owner-scoped card counts and recent list order against Prisma queries, checks the inclusive UTC `windowStart` boundary and the preceding millisecond, rejects query injection, and checks Staff dashboard denial.
- The Staff API test compares active ownership and assigned Action counts, all status and IT Priority buckets, recent and urgent ordering, Administrator self-scoping, and a two-Action single-Ticket fixture against database queries.
- The filter API test compares card counts with Requester and Staff drill-down pagination totals, checks fixed UTC windows and positive matching-action counts, and rejects duplicate or incompatible query parameters.
- The component tests cover card and list URLs, zeros, empty lists, forbidden and dependency failures, and incomplete `200` responses without showing stale counts.
- The browser spec covers Requester ownership-safe `404`, Staff and Administrator drill-down, loading/failure/Retry, and no horizontal overflow at 1440×900, 820×1180, and 390×844. Six screenshots are stored under `artifacts/lab-04/screenshots/requester-dashboard/` and `artifacts/lab-04/screenshots/staff-dashboard/`.
- API tests run against the isolated `lab2_test` schema; browser tests reset only the isolated `lab3_e2e` schema. Neither runner targets `public`.

Version history: 2026-10-31 — Issue #57 plan authored on `feature/57-lab4-engineering-contract-fake` before Lab 4 implementation; all statuses were Planned and independent review was pending. 2026-10-31 — Issue #61 dashboard evidence and executed row statuses added on `feature/61-lab4-role-dashboards-fake`. Future entries must use actual dates, commits, PRs, reviewers, and executed results rather than inferred evidence.
