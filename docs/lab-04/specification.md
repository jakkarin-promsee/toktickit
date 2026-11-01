# Lab 4 Engineering Contract

Status: Issue #57 contract, peer approved in [PR #64](https://github.com/jakkarin-promsee/toktickit/pull/64), integrated through the reviewed [release PR #70](https://github.com/jakkarin-promsee/toktickit/pull/70), and verified on final `main` commit `3d049a0` on 1 November 2026. Posted author responses to the review comments remain unverified. This contract extends the approved Lab 1–3 behavior in `../lab-03/specification.md`, `../lab-03/api-spec.md`, and `../lab-03/ui-spec.md`; only rules explicitly replaced here change.

## 1. Sprint Goal

Complete the service-desk workflow by recording work on Tickets, enforcing a defensible resolution gate, giving each role useful operational dashboards, and preserving the tested Labs 1–3 product.

## 2. Stakeholder Request

IT Staff need a durable, attributable record of each action on a Ticket while the primary Ticket Owner coordinates the case. Requesters should see the work on their own Tickets and signal apparent resolution, but only IT Staff can formally resolve. Dashboards should summarize authoritative data and lead back to detail screens.

## 3. Scope

Included: Action Taken persistence and lifecycle, Ticket status history and resolution gate, role dashboards, Zen Green screens, data-preserving migration and seed, security, accessibility, and final regression evidence.

Excluded: SLA clocks, escalation engines, on-call scheduling, breach or external email/SMS/LINE/push notifications, inventory, spare parts, purchasing, costing, timesheets, payroll, multilevel approvals, electronic signatures, advanced BI, custom report builders, export warehouses, multitenancy, production cloud operations, and unapproved features. Attachment Notes are text referring to existing Ticket Attachments; they do not add an Action-specific upload feature.

## 4. Functional Requirements

- FR-01 The system shall let active IT Staff and Administrators create multiple Actions Taken under an accessible Ticket, with backend-owned identity and audit data.
- FR-02 The system shall let authorized actors assign or reassign an active Action Taken to an eligible active IT Staff or Administrator without changing the Ticket Owner.
- FR-03 The system shall let authorized actors edit approved Action Taken content and move it through Planned, In Progress, Completed, or Cancelled states according to the lifecycle matrix.
- FR-04 The system shall validate Action Date/Time, Action Description, Result, Follow-Up Required, conditional Follow-Up Note, and Attachment Notes at both the API and form boundaries.
- FR-05 The system shall show every Action Taken on an owned Ticket to its Requester, without Action Taken write controls or Internal Notes.
- FR-06 The system shall preserve Action Taken creator, performer, assignee, completion/cancellation actor and time, versions, and append-only Action events.
- FR-07 The system shall enforce the complete eight-status Ticket transition matrix, primary-owner prerequisites, backend-validated confirmation for the existing confirmed transitions, and a Completed Action prerequisite for formal resolution.
- FR-08 The system shall retain the Requester's Problem Appears Resolved signal as advisory and record Ticket workflow events without rewriting earlier events.
- FR-09 The system shall reject stale Action and Ticket writes atomically and give a safe refresh path without silently retrying a draft.
- FR-10 The system shall return Requester dashboard metrics and recent lists scoped to the authenticated owner, with accurate links to My Tickets or Ticket Detail.
- FR-11 The system shall return IT Staff dashboard metrics, current-user Actions Taken, and recent/urgent Tickets from authoritative data, with practical drill-down.
- FR-12 The system shall allow Administrators to use the Staff dashboard and Action Taken operations defined here while retaining Lab 3 read-only access to existing Staff Ticket operations.
- FR-13 The system shall migrate and seed without losing Users, Tickets, Attachments, Public Comments, Internal Notes, or legacy zero-action Tickets.
- FR-14 The system shall preserve Labs 1–3 authentication, ownership, authorization, Ticket creation/search, Attachments, Comments, Notes, account management, health, and safe-failure behavior.
- FR-15 The system shall render role navigation, dashboards, Actions Taken, and workflow feedback in Zen Green at desktop, tablet, mobile, keyboard-only, and 200% zoom conditions.
- FR-16 The system shall provide traceable automated and visual evidence for each acceptance criterion before claiming product completion.

## 5. Business Rules

### Actions Taken and audit

- BR-01 Each Action Taken belongs to exactly one Ticket through a restricted foreign key; a Ticket may have zero or many Actions Taken and none is synthesized for legacy Tickets.
- BR-02 A Ticket has zero or one primary Owner; an Action Taken has its own nullable Assignee, and creator, performer, assignee, completer, and Ticket Owner may be different eligible people.
- BR-03 `actionAt` is the entered date/time of the described or planned work, distinct from server-generated `createdAt` and `updatedAt`; it is a UTC instant, must be a valid ISO 8601 offset timestamp, must be at or after the Ticket creation instant, and cannot be more than 365 days after the current server instant.
- BR-04 `description` is trimmed 1–2,000 Unicode characters; `result` is trimmed 0–2,000 for Planned/In Progress and 1–2,000 for Completed; `attachmentNotes` is nullable trimmed text of at most 500 characters and never contains uploaded bytes or an Attachment ID grant.
- BR-05 `followUpRequired` is Boolean; when true, `followUpNote` is trimmed 1–1,000 Unicode characters, and when false it must be null. Clearing the flag clears the note only when explicitly submitted by the client; an omitted field is never silently erased.
- BR-06 `createdByUserId` and `performedByUserId` are set to the authenticated creator at creation, never accepted from the client, and remain immutable; “Performed by” identifies the authenticated person who recorded the described action, while `completedBy` separately identifies who closed the work item.
- BR-07 `assigneeId` may be null while Planned or when Cancelled directly from an unassigned Planned action; In Progress and Completed require a non-null assignee. A non-null assignee must be active and have role IT Staff or Administrator when assigned or when starting/completing; the backend rechecks activity and role in the write transaction. An inactive selected assignee returns `422 INACTIVE_ASSIGNEE` and an ineligible/missing selected assignee returns `422 INVALID_ASSIGNEE` without mutation. If an existing assignee later becomes inactive, another active Staff/Administrator must reassign the nonterminal Action before it can start or complete.
- BR-08 An Action Taken starts `PLANNED`; permitted transitions are Planned → In Progress, Completed, or Cancelled and In Progress → Completed or Cancelled. Completed and Cancelled are terminal; no implicit reopen, delete, or status rollback exists.
- BR-09 Starting or completing requires a non-null eligible assignee; completion also requires a non-empty Result and a valid conditional Follow-Up Note. A Planned action may complete directly for work already done.
- BR-10 The actor for assignment, edit, transition, completion, or cancellation must be active IT Staff or Administrator. For content edit, transition, completion, and cancellation the actor must be the current assignee or the Ticket Owner; the authenticated creator may edit or cancel their own unassigned Planned action, and any active IT Staff or Administrator may assign an unassigned Planned action or reassign a nonterminal action. Administrators follow these same Action actor conditions even though existing Staff Ticket mutations remain denied to them.
- BR-11 Action content and assignment may change only in Planned or In Progress. Assign/reassign requires `assigneeId` different from the current value and UI confirmation when replacing a non-null assignee; cancellation requires a trimmed 1–500 character reason and confirmation. Completed/Cancelled records are immutable.
- BR-12 Every successful Action create/edit/assign/status change appends an `ActionEvent` with action, actor, type, occurredAt, old/new status or assignee where relevant, and resulting version. Completion sets `completedAt`/`completedByUserId`; cancellation sets `cancelledAt`/`cancelledByUserId` and reason. Events and audit identities are never updated or deleted.
- BR-13 Action list order is `actionAt asc, createdAt asc, id asc` across all roles and states; no item is hidden from an owned Ticket merely because it is Planned, Cancelled, or by another staff member.
- BR-14 Requesters see all Actions Taken on their own Tickets with `actionAt`, `description`, `result`, `status`, `performedBy` display name, `assignee` display name or null, `followUpRequired`, `followUpNote`, `attachmentNotes`, `createdAt`, `updatedAt`, and completion/cancellation time. They do not see ActionEvent history, internal actor IDs, cancellation reason, Internal Notes, or any Action on another owner's Ticket. All Action content is therefore shared content and must not contain private operational notes; the existing Internal Notes feature is the private channel.
- BR-15 The client cannot set `ticketId` in the body, creator/performer/completer/canceller/event actors, audit timestamps, versions other than expected versions, status on create, or Ticket Owner through an Action request. Unknown/protected keys are rejected.
- BR-16 Create requires `Idempotency-Key` as a UUID; replay by the same actor on the same Ticket with the same normalized payload returns the original `201` body without another Action/Event, while reuse with different payload returns `409 IDEMPOTENCY_KEY_REUSED`.

### Ticket workflow

- BR-17 The eight Ticket statuses remain `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`; only active IT Staff may change status, all omitted source/target pairs are denied, and transitions to Resolved, Closed, Cancelled, or Reopened retain Lab 3's backend requirement for `confirmed: true` after explicit UI confirmation.
- BR-18 A target requiring an Owner needs a current active IT Staff or Administrator Ticket Owner. The Ticket Owner coordinates the Ticket, but any active IT Staff may perform an allowed status transition; Administrator Action privileges do not grant Ticket status, claim, reassign, reprioritize, comment, note, or Requester signal writes.
- BR-19 A transition to Resolved requires at least one Action Taken on that Ticket in `COMPLETED` whose `completedTicketVersion` is greater than the latest Reopened event's resulting Ticket version when one exists; with no Reopened event, any Completed Action qualifies. The version ordering is authoritative even when two events share a timestamp. Cancelled or merely In Progress Actions do not qualify. A zero-action Ticket cannot newly transition to Resolved, including a legacy Ticket, but a legacy Ticket already Resolved/Closed retains its status and may close/reopen when the matrix's Owner prerequisite is satisfied.
- BR-20 The resolution gate, current status, active Owner, and submitted Ticket version are checked in one transaction; a gate failure returns `409 RESOLUTION_ACTION_REQUIRED` and no status or history change. A Requester signal may inform staff but is never required for resolution and never changes status by itself.
- BR-21 Requester Problem Appears Resolved remains available only to the submitter while Waiting for Requester, only once per waiting cycle, with confirmation; entering In Progress, Waiting for Requester anew, or Reopened clears the prior signal as indicated in the matrix.
- BR-22 New Ticket creation appends a `CREATED` TicketWorkflowEvent. Ticket status transitions append a `TicketWorkflowEvent` and update the current status, `lastStatusChangedAt`, `lastStatusChangedByUserId`, `updatedAt`, and integer `version` atomically. Owner, priority, requester-signal, and Action writes also append typed workflow events and advance Ticket `version` and `updatedAt` in the same transaction, so a new Action appears in Recently Updated; old events and completed work are never overwritten or deleted.
- BR-23 `TicketWorkflowEvent` for legacy Tickets starts with one migration-time `BASELINE` snapshot containing the observed status and `actorId=null`; it does not claim an unknown historical transition. Existing Ticket status and timestamps are not modified by this backfill.
- BR-24 Every Action write requires expected `ticketVersion`; updates also require expected `actionVersion`. Atomic compare-and-increment on both records prevents a concurrent Ticket change or Action edit from being overwritten; a mismatch returns `409 STALE_TICKET` or `409 STALE_ACTION` with no partial event, and the UI preserves input for explicit refresh/retry.

### Dashboard and inherited behavior

- BR-25 Dashboard calculations use one backend `asOf` UTC instant per response and a seven-UTC-calendar-day window `[00:00:00Z six days before the asOf date, asOf]`; all counts/lists use the same snapshot instant. No browser clock or client-supplied requester ID determines membership.
- BR-26 Requester “Open Tickets” counts owned Tickets in New, Open, In Progress, Waiting for Requester, or Reopened; “Waiting for You” counts owned Waiting for Requester Tickets; “Recently Updated” counts owned Tickets with `updatedAt` in the window; “Recently Resolved” counts owned Tickets currently Resolved with `lastStatusChangedAt` in the window. A Ticket may contribute to multiple cards.
- BR-27 Requester recent list contains at most five owned Tickets with `updatedAt` in the window ordered `updatedAt desc, id desc`; attention list contains at most five owned Waiting for Requester Tickets ordered the same way. All zero cards return `0`, lists return `[]`, and no null count is used.
- BR-28 Staff “Unassigned Tickets” counts Owner null and nonterminal status (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`); “My Tickets” counts current-user Owner with those statuses; “My Active Actions” counts Actions assigned to the authenticated user in Planned/In Progress whose Ticket has a nonterminal status. Administrators use the same formula for their own ID, with no User-account count in Lab 4.
- BR-29 Staff `byStatus` returns all eight Ticket status counts, including zeros, and `byItPriority` returns Low/Medium/High counts across all Tickets, including terminal Tickets; these are independent distributions, not subsets of My Tickets.
- BR-30 Staff recent list contains at most five Tickets updated in the window ordered `updatedAt desc, id desc`; urgent list contains at most five nonterminal High IT Priority Tickets ordered `updatedAt desc, id desc`; current-user Action list contains at most five qualifying Actions ordered `actionAt asc, id asc`. Staff/Administrator may see all Tickets, but the “My” filters use only the authenticated ID.
- BR-31 Card/list drill-down uses the documented My Tickets or Staff Queue filter view and specific Ticket IDs; `my-active-actions` Queue view returns Tickets with at least one qualifying Action and shows the matching-action count per row, so the number of Ticket rows may differ from the Action card count.
- BR-32 Dashboard recent lists use concise Ticket summaries or Action references, never whole Ticket collections, Comments, Notes, Attachment storage metadata, credentials, or unauthorized User data. Counts and lists are computed from persisted Tickets/Actions in a consistent database snapshot.
- BR-33 Existing Lab 3 sessions, CSRF/Origin checks, mandatory password change, Requester ownership-safe `404`, Administrator User Management, Public Comments, Internal Notes, Attachments, and Staff Ticket restrictions remain authoritative. Every new write is authorized by the backend after authentication and before protected resource lookup.
- BR-34 New times are stored as UTC `timestamptz` and returned as ISO 8601 `Z`; UI may localize display but includes an exact accessible UTC timestamp. All plain-text Action fields are escaped on render and never interpreted as HTML.
- BR-35 Health retains the exact Lab 1 process-liveness `GET /api/health` contract: `200 { "status": "ok", "service": "TokTickIT API" }` with no database query or protected data. Database dependency failures on data endpoints return safe `503 DEPENDENCY_UNAVAILABLE`; they do not change the health payload.
- BR-36 All existing tests from Labs 1–3 remain regression gates; approved behavior changes only where this contract explicitly extends the resolution gate and Action/dashboard features.

### Authorization matrix

`R` means read and `W` means a backend-enforced write; `own` means the authenticated submitter, and “any” means any Ticket after role authorization. Direct API access has the same limits as visible UI controls.

| Operation | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Create Ticket | W as authenticated submitter | Denied | Denied |
| My Tickets / Staff Queue and Ticket Detail | R own via Requester routes | R any via Staff routes | R any via Staff routes; read-only workflow |
| Attachment list/download and upload/soft removal | R/W own | R any; no upload/removal | R any; no upload/removal |
| Public Comments | R/W own | R/W any | R any; no composition |
| Internal Notes | Denied | R/W any | R any; no write |
| Ticket claim, owner, IT Priority, formal status | Denied | W any within matrix | Denied |
| Problem Appears Resolved | W own while Waiting | Denied | Denied |
| Action list/detail and shared fields | R own, all items | R any | R any |
| Action create and unassigned assignment | Denied | W any eligible nonterminal Ticket | W any eligible nonterminal Ticket |
| Action edit, reassign, transition, complete, cancel | Denied | W under BR-10/11 | W under BR-10/11 |
| Requester dashboard | R own | Denied | Denied |
| Staff dashboard | Denied | R any plus own filters | R any plus own filters |
| User Management | Denied | Denied | Existing Lab 3 R/W |

Action writes are denied while the Ticket is Resolved, Closed, or Cancelled; Reopened restores eligible Action writes. Existing Ticket read permissions remain independent of Action write permissions. Inactive users cannot authenticate or act.

### Complete Ticket status-transition matrix

Cells show allowed target and owner prerequisite (`O` = active Owner required, `–` = not required); `×` means denied. All allowed transitions require active IT Staff and an expected Ticket version. Resolved additionally requires BR-19. Resolved, Closed, Cancelled, and Reopened require both an explicit UI confirmation and `confirmed: true` validated by the backend; confirmation never bypasses the Owner or Action gate.

| From \ To | New | Open | In Progress | Waiting for Requester | Resolved | Closed | Reopened | Cancelled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| New | × | – | × | × | × | × | × | – |
| Open | × | × | O | O | × | × | × | – |
| In Progress | × | × | × | O | O + gate | × | × | O |
| Waiting for Requester | × | × | O | × | O + gate | × | × | O |
| Resolved | × | × | × | × | × | O | – | × |
| Closed | × | × | × | × | × | × | – | × |
| Reopened | × | × | O | O | O + gate | × | × | O |
| Cancelled | × | × | × | × | × | × | – | × |

Moving to Waiting for Requester, back to In Progress from Waiting, or to Reopened clears a prior requester-resolution signal. New → Open and New/Open → Cancelled retain the Lab 3 no-owner allowance. Resolved → Closed checks Owner but does not reapply the Action gate, so an already-Resolved legacy Ticket may close.

### Complete Action Taken status-transition matrix

| From \ To | Planned | In Progress | Completed | Cancelled |
| --- | --- | --- | --- | --- |
| Planned | × | Allowed; assignee required | Allowed; assignee and Result required | Allowed; reason required |
| In Progress | × | × | Allowed; assignee and Result required | Allowed; reason required |
| Completed | × | × | × | × |
| Cancelled | × | × | × | × |

All allowed Action transitions require BR-10 actor eligibility and both expected versions. A cancellation may have no assignee while Planned; cancelled Actions never satisfy the Ticket resolution gate.

## 6. UI Specification Summary

The normative screen contract is [`ui-spec.md`](./ui-spec.md). The authenticated shell adds a role-appropriate Dashboard entry. Staff Ticket Detail adds an Actions Taken section with list, create, view/edit, assignment, status, complete, and cancel modes; Requester Detail shows the same shared Action information read-only. Ticket workflow controls expose only matrix-permitted targets, explain Owner/Action prerequisites, preserve drafts on recoverable failure, and refresh status after success. Dashboard cards and lists use labels, text status cues, exact drill-downs, loading/zero/error feedback, semantic controls, visible focus, and Lab 3 responsive breakpoints.

## 7. Data Changes

`ActionTaken`: UUID `id`, restricted UUID `ticketId`, UTC `actionAt`, `description varchar(2000)`, `result varchar(2000)` default empty, `status ActionStatus` default `PLANNED`, `createdByUserId`, `performedByUserId`, nullable `assigneeId`, `followUpRequired boolean`, nullable `followUpNote varchar(1000)`, nullable `attachmentNotes varchar(500)`, nullable `completedAt`/`completedByUserId`/`completedTicketVersion`, nullable `cancelledAt`/`cancelledByUserId`/`cancellationReason varchar(500)`, integer `version` default zero, `createdAt`, and `updatedAt`. `ActionEvent` has immutable UUID ID, Action/Ticket foreign keys, type, actor, occurredAt, resulting Action/Ticket versions, and JSON change snapshot constrained to approved nonsecret fields. `TicketWorkflowEvent` has immutable UUID ID, Ticket FK, type, nullable actor for a migration baseline, nullable `subjectActionId` for Action writes, occurredAt, resulting Ticket version, and approved old/new snapshot. `ActionCreateRequest` stores the unique `(actorId, ticketId, idempotencyKey)` tuple, normalized request hash, Action ID, original 201 response snapshot, and createdAt so an exact replay cannot create a second Action. All FKs restrict deletion; new time columns use UTC `timestamptz`.

Design choice 1: retain the Ticket's single Owner separately from Action Assignee and Performer. This permits several staff members to contribute without changing accountability for the Ticket and makes current-user Action queries honest. Design choice 2: use append-only event tables alongside current-state columns. Current columns keep existing reads and indexed dashboards efficient; events preserve transitions and audit evidence without pretending legacy history is known. Design choice 3: advance both Ticket and Action versions on Action writes so resolution and dashboard updates cannot race with a stale Action edit.

Indexes: `ActionTaken(ticketId, actionAt, createdAt, id)` for stable Ticket lists; `(assigneeId, status, actionAt, id)` for current-user work; `(ticketId, status, completedTicketVersion)` for the resolution gate; `ActionEvent(actionId, occurredAt, id)` and `TicketWorkflowEvent(ticketId, occurredAt, id)` for ordered audit; and unique `ActionCreateRequest(actorId, ticketId, idempotencyKey)` for safe replay. Retain Lab 3 Ticket indexes for Owner/status/priority/updated time; add `(currentStatus, itPriority, updatedAt, id)` for urgent queries and `(submittedByUserId, currentStatus, updatedAt, id)` for Requester cards where query plans justify them. Foreign keys and enum/check constraints prevent orphaned or invalid rows; API conditional checks are revalidated in transactions.

Migration/backfill: (1) back up the local PostgreSQL database and record pre-migration counts and referential checks for Users, Tickets, Attachments, Public Comments, and Internal Notes; (2) create new enum/tables/indexes with no destructive change to existing rows or columns; (3) insert one `BASELINE` event per legacy Ticket with an event UUID deterministically derived from its Ticket UUID, migration time, current status/Owner/Priority/version, and null actor, without modifying current Ticket timestamps/status; (4) verify counts, foreign-key joins, zero orphan rows, and representative legacy zero-action Ticket reads/dashboard counts before enabling new writes; (5) deploy app and seed, then verify rollback rehearsal on a disposable copy. If validation fails, restore the backup and prior app build together; a down migration that drops new tables would discard real Action history and is not used after writes begin. Forward recovery fixes the migration and reruns guarded baseline insertion.

Seed: find synthetic `example.test` Users/Tickets by stable email/Ticket Number and insert only missing fixture rows, keep all Lab 3 examples, include all eight Ticket statuses and Low/Medium/High priorities, assigned and unassigned Tickets, zero/one/multiple Actions on different performers, Planned/In Progress/Completed/Cancelled Actions, inactive-assignee rejection fixture, a recently Reopened Ticket needing fresh completion, and UTC dates that demonstrate zero and nonzero dashboard cards. Give seeded Actions and events deterministic UUIDs derived from stable fixture names and never overwrite real edits; repeated runs do not duplicate rows or reset completed work. Local credentials continue to come only from the documented environment variable, never committed plaintext.

## 8. API Contract

The normative API contract is [`api-spec.md`](./api-spec.md). New Action endpoints live under `/api/tickets/:ticketId/actions`, dashboard reads under `/api/dashboard/requester` and `/api/dashboard/staff`, and the existing Staff status endpoint gains the resolution gate. JSON uses `{ "data": ... }`, 204 has no body, and errors use the Lab 3 safe envelope. Existing session, CSRF/Origin, ownership-safe lookup, validation, and status codes remain. Both Action and Ticket version preconditions are explicit in write bodies; creation also has an idempotency key.

## 9. Acceptance Criteria

- AC-01 A valid Action create stores exactly one Action under the requested Ticket with server-derived creator/performer, distinct optional assignee, UTC fields, version zero, and one creation event; repeat idempotency key does not duplicate it.
- AC-02 Action create/edit rejects invalid date, description, result, follow-up combination, notes, protected actor fields, and invalid status with field-safe errors and no partial write.
- AC-03 Assignment/reassignment accepts only eligible active staff/admin assignees, keeps Ticket Owner unchanged, rejects inactive/ineligible assignees, and records actor/version/event.
- AC-04 Every permitted Action edit and transition, including direct complete and cancel, succeeds for a BR-10 actor with required fields; omitted/terminal transitions and unauthorized actor attempts fail without mutation.
- AC-05 An owned Requester sees every Action on the Ticket in stable order with the shared fields, no mutation controls or private history; a cross-owner Requester gets an indistinguishable 404.
- AC-06 IT Staff and Administrator Action capabilities match the matrix, while Administrator attempts to use existing Staff Ticket status/Owner/Priority/Comment/Note writes remain denied.
- AC-07 Concurrent Action or Ticket changes reject stale expected versions, preserve current values/events, and show a draft-preserving explicit refresh path.
- AC-08 Every allowed Ticket transition and omitted pair follows the eight-status matrix, active-owner prerequisites, actor/time/version audit, UI and backend confirmation rules, and signal-clearing rules.
- AC-09 Resolved is blocked with zero or nonqualifying Actions, including legacy zero-action and pre-Reopened completed work; a qualifying current-cycle Completed Action permits resolution atomically. Already-Resolved legacy Tickets can close when an eligible Owner is present.
- AC-10 Requester Problem Appears Resolved is advisory, owned and Waiting-only, and never directly changes Ticket status or bypasses the Action gate.
- AC-11 Ticket/Action events are append-only, ordered and attributable; migration baselines do not invent historical actors or erase prior records.
- AC-12 Requester dashboard counts, attention/recent lists, UTC window, zero states, and drill-downs match owned persisted Tickets and never disclose another owner's information.
- AC-13 Staff/Admin dashboard counts, all status/priority buckets, current-user Action count/list, recent/urgent lists, UTC window, zero states, and drill-downs match persisted data.
- AC-14 Dashboard endpoints return concise shapes, enforce role gates, reject invalid query/framing, and fail safely without stale/cross-role data.
- AC-15 The Action UI covers list, create, view/edit, assign, status, complete, cancel, validation, inactive assignee, loading, empty, forbidden, missing, conflict, and recoverable failure at all three viewport classes.
- AC-16 Dashboard and workflow UI preserve Zen Green, semantic labels, keyboard/focus, 200% zoom, noncolor cues, no clipping/overlap/page overflow, and role navigation.
- AC-17 Migration preserves all Lab 1–3 rows/joins and legacy zero-action meaning; rerun seed/baseline creates no duplicates; recovery restores a verified prior state.
- AC-18 Authentication, Requester ownership, Ticket creation/list/detail, Attachments, Public Comments, Internal Notes, Staff Queue/detail, Administrator User Management, and health continue to pass approved Labs 1–3 regression behavior.
- AC-19 API and UI safe failures distinguish malformed, unauthenticated, forbidden, missing/cross-owner, validation, inactive-assignee, invalid transition, gate, stale conflict, and dependency failure without secret leakage or duplicate mutation.
- AC-20 Every AC is mapped to a planned test and target file; final Pass is recorded only after running the clean-environment suites and independent peer review checks this contract for rule gaps and conflicting or untestable criteria.

## 10. Definition of Done

- [ ] The four Issue #57 documents exist, agree on fields, IDs, roles, states, endpoints, and test mappings, and have an independent peer review with comments/responses recorded in the actual PR workflow.
- [x] Data migration and recovery rehearsal preserve Lab 1–3 data and verify zero-action legacy Tickets; seed is repeatable and contains the required demonstration cases.
- [x] Backend enforces every Action and Ticket write rule, ownership boundary, resolution gate, stale conflict, idempotency, safe error, audit event, and dashboard formula.
- [x] Desktop/tablet/mobile UI demonstrates all Part 5–9 rubric flows, including current-user Actions, Action assignment/edit/transition/complete/cancel, role visibility, blocked/successful resolution, drill-down, and zero/error states.
- [x] Planned unit, API/integration, UI/style, responsive, accessibility, security, workflow, migration, health, performance-smoke, E2E, and Labs 1–3 regression tests pass locally; the opt-in performance smoke runs separately from the normal suite, and `tests.md` records actual paths and results.
- [x] Visual evidence and keyboard review cover every major Lab 4 screen; README setup/migration/seed/demo instructions are current; no temporary controls, broken links, console errors, or placeholder copy remain in the checked local build.
- [x] Actual peer review and approved staged integration occurred through PRs #64–#69 into `lab4-staging` and PR #70 into `main`; no local fake-branch preparation is presented as a merged or approved real PR.

## 11. Assumptions and Decisions

- The handout names Action fields but not statuses. This contract chooses `PLANNED`, `IN_PROGRESS`, `COMPLETED`, and `CANCELLED` so assignment, edit, transition, completion, and cancellation in submission Part 6 are demonstrable and testable.
- “Performed by (auto)” means the authenticated person who records the Action. Completion may be performed by the assignee or Ticket Owner; the separate completion actor makes that distinction visible to Staff and auditable without rewriting the immutable performer.
- Action text is shared with Requesters on owned Tickets, including Attachment Notes and Follow-Up Note. Private operational details belong only in existing Internal Notes.
- A new resolution requires a Completed Action, and after Reopened it requires completion after that reopen. This is the smallest auditable gate that proves actual work without inventing SLA, approval, or mandatory Requester sign-off.
- UTC calendar-day windows make dashboard counts reproducible across browsers and time zones. Cards use a common server `asOf`, and filtered routes carry the same `from`/`through` values.
- Administrator Action write rights are a deliberate Lab 4 exception to Lab 3 Ticket read-only behavior; all other Administrator Staff Ticket writes remain denied.
- The four Issue #57 documents were prepared before Issues #58–#63 implementation. The original Planned results were updated only after local execution. The Issue #57 contract received an actual peer approval in PR #64; final `main` execution is recorded separately in `tests.md`.

### Traceability sample

`FR-07` final Ticket lifecycle → `BR-19` current-cycle Completed Action gate → `AC-09` zero/nonqualifying and qualifying resolution → `API-08` in `server/tests/lab-04/ticket-workflow.api.test.ts`.

### Version history

| Date | Change | Evidence state |
| --- | --- | --- |
| 2026-10-31 | Issue #57 engineering contract and Test DD prepared on `feature/57-lab4-engineering-contract-fake` before Lab 4 implementation. | Independent peer review pending; no Lab 4 implementation test is claimed Pass. |
| 2026-10-31 | Rechecked the contract against the handout, Lab 3 API and implementation, the UI contract, and AC-to-test mappings; clarified confirmed transitions, idempotent replay, event shapes, permissions, and test commands. | Existing Lab 1–3 Vitest suites passed locally; independent peer review and all Lab 4 implementation tests remain pending. |
| 2026-11-01 | Recorded local Issue #62 implementation and test completion; checked the locally evidenced Definition of Done items. | PR #64 was peer approved and merged into `lab4-staging`; later PR discussions, full staged integration, and final `main` run remain pending. See `tests.md` and repository `todo.md`. |
| 2026-11-01 | Closed the staged release through approved PR #70 and reran the full local gate at final `main` commit `3d049a0`. | Builds, server/client suites, E2E, visual, and separate performance smoke passed on isolated schemas. The first DoD item remains open only because posted author responses to PR comments have not been verified; see `reviewer.md`. |

### Independent reviewer checklist

These prompts remain open until the reviewer records the specific checks and author responses in the real PR discussion; the approval summary alone does not prove each hands-on challenge was performed.

- [ ] Challenge Action performer/assignee/completer semantics and each lifecycle transition, including direct completion and cancellation.
- [ ] Try an Administrator Action write and an existing Staff Ticket write to verify the deliberate permission boundary.
- [ ] Try zero-action, legacy already-Resolved, and post-Reopened resolution against the gate and event history.
- [ ] Recalculate Requester and Staff dashboard counts directly from seeded database rows, including UTC boundary instants, zeros, and multi-action Tickets.
- [ ] Check each AC against `tests.md` and record specific review comments/responses on the actual contract PR before main implementation PRs finish.
