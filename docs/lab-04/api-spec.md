# Lab 4 REST API Specification

Status: Issue #57 contract, peer reviewed and included in the Lab 4 release on `main` at `3d049a0`. The final `main` server, client, E2E, visual, and opt-in performance checks passed on isolated schemas on 1 November 2026; see `tests.md`. Base URL `/api`; JSON request/response except the inherited Attachment endpoints. `specification.md` is normative for business rules, and the approved `../lab-03/api-spec.md` remains normative for unchanged routes.

## 1. Shared security, framing, and error rules

The existing `toktickit_session` cookie, eight-hour absolute session expiry, mandatory password change, exact allowed Origin, and `X-CSRF-Token` for unsafe methods remain. Each new route authenticates and authorizes the role before protected lookup; Requester Ticket/Action lookup includes `submittedByUserId` in the database predicate so missing and cross-owner IDs produce identical `404 RESOURCE_NOT_FOUND`. Requesters cannot call Action writes or Staff dashboard/queue endpoints. Administrators can call the Action endpoints but retain read-only access to existing Staff Ticket mutations. Inactive assignees are rechecked within the transaction.

Every new JSON write body must be an object with only documented keys, `Content-Type: application/json`, and a bounded size of 32 KiB; inherited Lab 1–3 routes retain their existing framing limits. Invalid JSON, unsupported keys, protected identity/audit/status-on-create keys, malformed UUID path IDs, missing required properties, or non-object framing return `400 MALFORMED_REQUEST`. Invalid semantic values return `422 VALIDATION_ERROR` with field messages, except explicit `INACTIVE_ASSIGNEE`/`INVALID_ASSIGNEE`. Unknown, duplicate, or invalid query parameters return `400 INVALID_QUERY`. ISO timestamps require an explicit offset (`Z` or `±HH:MM`) and normalize to UTC; server-owned times use ISO 8601 `Z`.

Success uses `{ "data": ... }`; list responses include `pagination` where specified; `204` has no body. Error envelope is `{ "error": { "code": "...", "message": "...", "fields": { "field": "..." }? } }`. Messages never expose SQL, stack traces, storage paths, tokens, hashes, another Requester's existence, or private ActionEvent fields. Common `401 AUTHENTICATION_REQUIRED`, `403 PASSWORD_CHANGE_REQUIRED|CSRF_INVALID|FORBIDDEN`, safe `500 INTERNAL_ERROR`, and `503 DEPENDENCY_UNAVAILABLE` apply to every protected endpoint. A `403` is role-wide and occurs before lookup; `404` means an authorized role cannot see that particular resource. `409` errors leave all rows and events unchanged. A database transaction or dependency failure cannot return a partial success.

| HTTP | Code | Meaning |
| --- | --- | --- |
| 200 | — | Successful GET or PATCH |
| 201 | — | Successful Action creation, including identical idempotency replay |
| 400 | MALFORMED_REQUEST / INVALID_QUERY | Bad framing, ID, protected/unknown body key, or query |
| 401 | AUTHENTICATION_REQUIRED | Missing, expired, or revoked session |
| 403 | FORBIDDEN / PASSWORD_CHANGE_REQUIRED / CSRF_INVALID | Role or session gate failure |
| 404 | RESOURCE_NOT_FOUND | Missing/cross-owner Ticket or Action, with identical Requester response |
| 409 | STALE_TICKET / STALE_ACTION / INVALID_ACTION_TRANSITION / INVALID_STATUS_TRANSITION / OWNER_REQUIRED / RESOLUTION_ACTION_REQUIRED / ACTION_TICKET_CLOSED / ACTION_ASSIGNEE_REQUIRED / ASSIGNMENT_UNCHANGED / IDEMPOTENCY_KEY_REUSED | Valid request conflicts with current state |
| 422 | VALIDATION_ERROR / INACTIVE_ASSIGNEE / INVALID_ASSIGNEE | Well-formed field or assignee invalid |
| 500 / 503 | INTERNAL_ERROR / DEPENDENCY_UNAVAILABLE | Safe unexpected/dependency failure |

For a new Action write the server checks `ticketVersion` first, then `actionVersion` where applicable, then state/assignee/resolution rules in one transaction. A create request first resolves the actor/Ticket/idempotency-key tuple and compares the normalized payload: an identical replay returns its stored original `201` response before a stale-version check, while a changed payload returns `409 IDEMPOTENCY_KEY_REUSED`; only a new key proceeds to version and state checks. A stale response uses the inherited error envelope, for example `{ "error": { "code": "STALE_ACTION", "message": "This action changed. Refresh before trying again." } }`; the client obtains fresh versions through the authorized GET endpoints and never automatically resubmits a stale draft.

## 2. Resource shapes and field visibility

```ts
type ActionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type PersonReference = { id: number; displayName: string; role?: "IT_STAFF" | "ADMINISTRATOR" };
type PersonLabel = { displayName: string };
type AuditValue = string | number | boolean | null;
type AuditChanges = Record<string, { before: AuditValue; after: AuditValue }>;
type ActionShared = {
  id: string; ticketId: string; actionAt: string; description: string; result: string;
  status: ActionStatus; performedBy: PersonLabel; assignee: PersonLabel | null;
  followUpRequired: boolean; followUpNote: string | null; attachmentNotes: string | null;
  createdAt: string; updatedAt: string; completedAt: string | null; cancelledAt: string | null;
};
type ActionStaff = Omit<ActionShared, "performedBy" | "assignee"> & {
  performedBy: PersonReference; assignee: PersonReference | null;
  createdBy: PersonReference; completedBy: PersonReference | null; cancelledBy: PersonReference | null;
  cancellationReason: string | null; version: number; ticketVersion: number;
};
type ActionForRequester = ActionShared;
type ActionEvent = {
  id: string; type: "CREATED" | "EDITED" | "ASSIGNED" | "STATUS_CHANGED" | "COMPLETED" | "CANCELLED";
  actor: PersonReference; occurredAt: string; resultingActionVersion: number; resultingTicketVersion: number;
  changes: AuditChanges;
};
```

`ActionShared` is returned for Requesters on owned Tickets with performer/assignee display names only; Staff/Administrator receive `ActionStaff` with eligible User IDs for controls. `ticketVersion` is the parent Ticket's version at response time, except an identical idempotency replay returns the original creation response snapshot. Public Action text is escaped plain text; Internal Notes and raw event snapshots are never embedded in a Requester response. No password, email, credential state, attachment storage path, checksum, or private event actor ID appears in Requester Action views. Staff-only events use `AuditChanges`: each changed field has explicit `before` and `after` safe scalar values, with null for an absent prior value; they never return secret values.

## 3. Actions Taken endpoints

### GET /api/tickets/:ticketId/actions

Requester may list only an owned Ticket; IT Staff/Administrator may list any Ticket. No query parameters are accepted. `200 { "data": ActionForRequester[] | ActionStaff[] }`, ordered `actionAt asc, createdAt asc, id asc`; a legacy zero-action Ticket returns `{ "data": [] }`. `400` malformed ID/query, `401/403`, `404` missing/cross-owner, safe `500/503`. The list is complete for one Ticket and does not paginate away older Actions.

### GET /api/tickets/:ticketId/actions/:actionId

The same read roles apply; Action lookup is constrained by both Ticket ID and Action ID. `200 { "data": ActionForRequester | ActionStaff }`. `400` malformed ID, `401/403`, `404` missing/cross-owner/wrong-Ticket Action, safe `500/503`.

### GET /api/tickets/:ticketId/actions/:actionId/events

IT Staff/Administrator only. `200 { "data": ActionEvent[] }` ordered `occurredAt asc, id asc`; `400` malformed ID/query, `401/403` Requester forbidden before lookup, `404` missing/wrong-Ticket Action, safe `500/503`. ActionEvent is append-only and not client-editable.

### POST /api/tickets/:ticketId/actions

IT Staff/Administrator only; Ticket must be New, Open, In Progress, Waiting for Requester, or Reopened. Required header `Idempotency-Key: <UUID>` and body `{ "ticketVersion": 4, "actionAt": "2026-10-31T09:30:00+07:00", "description": "Diagnosed network adapter", "result": "", "assigneeId": 12, "followUpRequired": true, "followUpNote": "Check again tomorrow", "attachmentNotes": "See existing Ticket image" }`. `assigneeId`, `followUpNote`, and `attachmentNotes` may be null; all named keys are required except `result`, which defaults to empty. Missing/malformed idempotency key is `400 MALFORMED_REQUEST`. `actionAt` follows BR-03, description/result/follow-up/notes follow BR-04/05, assignee follows BR-07. Status is always Planned, createdBy and performedBy are the authenticated actor, server time is authoritative, Action version starts at 0, Ticket version increments by one, and creation events append atomically. `201 { "data": ActionStaff }` with `Location: /api/tickets/:ticketId/actions/:actionId`; identical replay returns the original `201` body and Location, even if Ticket version later changes. Changed-payload key reuse returns `409 IDEMPOTENCY_KEY_REUSED`; stale version returns `409 STALE_TICKET`; terminal Ticket returns `409 ACTION_TICKET_CLOSED`; validation/role/missing/dependency codes follow §1.

### PATCH /api/tickets/:ticketId/actions/:actionId

Content edit only. IT Staff/Administrator may edit a Planned/In Progress Action when they are current assignee or Ticket Owner, or its authenticated creator while it remains unassigned Planned. Required body `{ "ticketVersion": 5, "actionVersion": 0, "actionAt": "2026-10-31T10:00:00+07:00", "description": "Replaced network adapter", "result": "Connection restored", "followUpRequired": false, "followUpNote": null, "attachmentNotes": "See existing Ticket photo" }`; editable content fields form a complete replacement so omission is `400`, while protected `assigneeId`, `status`, actor/timestamps, and Ticket fields are rejected. `200 { "data": ActionStaff }` after version/event increments. Terminal Action or Ticket returns `409 INVALID_ACTION_TRANSITION` or `ACTION_TICKET_CLOSED`; unauthorized role/actor `403 FORBIDDEN`; missing/wrong-Ticket `404`; stale/validation/common failures follow §1.

### PATCH /api/tickets/:ticketId/actions/:actionId/assignee

IT Staff/Administrator may assign a Planned unassigned Action or reassign any nonterminal Action. Required body `{ "ticketVersion": 6, "actionVersion": 1, "assigneeId": 13 }`; assignee cannot be null, must differ from current, and must be active IT Staff/Administrator. Replacing an existing assignee requires UI confirmation but backend still enforces role, eligibility, versions, and state. `200 { "data": ActionStaff }` with unchanged Ticket Owner/performer and appended assignment event. Same assignee returns `409 ASSIGNMENT_UNCHANGED`; terminal Action/Ticket, stale, invalid/inactive assignee, and common failures follow §1.

### PATCH /api/tickets/:ticketId/actions/:actionId/status

IT Staff/Administrator current assignee or Ticket Owner may transition a nonterminal Action; authenticated creator may cancel their own unassigned Planned Action. Required body for start/complete `{ "ticketVersion": 7, "actionVersion": 2, "status": "IN_PROGRESS" }` or `{ "ticketVersion": 7, "actionVersion": 2, "status": "COMPLETED" }`; completion uses the Action's already saved Result/Follow-Up Note and sets `completedAt`/`completedBy` to server time/current actor and `completedTicketVersion` to the newly incremented parent Ticket version. Required body for cancellation adds `"reason": "Duplicate work item"`; reason is forbidden for other targets, and cancellation requires UI confirmation. Valid edges are Planned → In Progress/Completed/Cancelled and In Progress → Completed/Cancelled. Start/complete require an active eligible assignee; complete requires nonempty Result; cancellation may be unassigned from Planned. `200 { "data": ActionStaff }`; invalid edge/terminal state returns `409 INVALID_ACTION_TRANSITION`; missing assignee returns `409 ACTION_ASSIGNEE_REQUIRED`; inactive existing assignee returns `422 INACTIVE_ASSIGNEE`; missing Result or reason/conditional note returns `422 VALIDATION_ERROR`; other common failures follow §1.

No DELETE Action endpoint exists. Completed and Cancelled Actions are immutable, but remain readable and count or do not count for resolution exactly as `specification.md` states.

## 4. Ticket workflow increment

### PATCH /api/staff/tickets/:ticketId/status

Retain the Lab 3 active-IT-Staff-only endpoint, body `{ "status": "RESOLVED", "version": 7, "confirmed": true }` for Resolved, Closed, Cancelled, or Reopened, `200 { "data": TicketDetail }`, and existing 400/401/403/404/409/422/500/503 behavior. Other allowed targets may omit `confirmed`; if supplied it must be Boolean. A missing or false confirmation for a required target returns `422 VALIDATION_ERROR` on `confirmed` without mutation. The UI obtains explicit user confirmation before sending the flag, and the backend still validates role, transition, Owner, Action gate, and version. Replace the Lab 3 “Actions Taken is never validated” exception: transitions to Resolved now atomically require BR-19, including zero-action and post-Reopened cases. Failure is `409 { "error": { "code": "RESOLUTION_ACTION_REQUIRED", "message": "Complete an action for this Ticket before resolving it." } }`. Existing `409 INVALID_STATUS_TRANSITION`, `OWNER_REQUIRED`, and `STALE_TICKET` remain. Successful status writes append a TicketWorkflowEvent and keep Lab 3 actor/time/version/signal behavior. Resolved → Closed does not rerun the gate.

### GET /api/staff/tickets/:ticketId/workflow-events

IT Staff/Administrator read-only. `200 { "data": [{ "id": "UUID", "type": "BASELINE|CREATED|STATUS_CHANGED|OWNER_CHANGED|PRIORITY_CHANGED|REQUESTER_SIGNAL|ACTION_CHANGED", "actor": PersonReference|null, "occurredAt": "UTC timestamp", "resultingTicketVersion": 8, "subjectActionId": "UUID or null", "changes": { "currentStatus": { "before": "IN_PROGRESS", "after": "RESOLVED" } } }] }`, ordered `occurredAt asc, id asc`. `changes` uses `AuditChanges`; `subjectActionId` is the Action ID only for `ACTION_CHANGED`, otherwise null. A `BASELINE` event has null actor, null subjectActionId, and observed fields with `before: null`, so it never asserts a historical transition. No edit/delete endpoint; Requester receives `403` before lookup. Existing Ticket Detail continues to show current status from Ticket, while this endpoint supplies auditable history to Staff/Administrator.

## 5. Dashboard endpoints and drill-down filters

`asOf` is one backend-generated UTC timestamp for each response; `windowStart` is UTC midnight six calendar dates before `asOf`, inclusive, and the upper bound is `asOf`, inclusive. Counts and lists are queried in one repeatable-read snapshot. No endpoint accepts an actor/requester ID or client-supplied `asOf`. Counts are nonnegative integers; all bucket keys are present even when zero; lists are arrays, never null. Dashboard endpoints reject all query parameters with `400 INVALID_QUERY`.

### GET /api/dashboard/requester

Requester only; `200` response shape:

```json
{
  "data": {
    "asOf": "2026-10-31T10:00:00.000Z",
    "windowStart": "2026-10-25T00:00:00.000Z",
    "cards": { "openTickets": 3, "waitingForYou": 1, "recentlyUpdated": 2, "recentlyResolved": 1 },
    "recentTickets": [{ "id": "UUID", "ticketNumber": "TKT-2026-000001", "summary": "Printer offline", "currentStatus": "OPEN", "updatedAt": "2026-10-30T09:00:00.000Z" }],
    "attentionTickets": [{ "id": "UUID", "ticketNumber": "TKT-2026-000002", "summary": "Cannot sign in", "currentStatus": "WAITING_FOR_REQUESTER", "updatedAt": "2026-10-29T09:00:00.000Z" }]
  }
}
```

Every card/list uses `submittedByUserId = authenticated user ID`. Formulas, five-item limit, and order are BR-26/27. `openTickets` links to `/tickets?view=open`; `waitingForYou` to `/tickets?view=attention`; `recentlyUpdated` to `/tickets?view=recent-updated&from=<windowStart>&through=<asOf>`; `recentlyResolved` to `/tickets?view=recent-resolved&from=<windowStart>&through=<asOf>`; list rows to `/tickets/:ticketId`. The URL parameters preserve the count's time window instead of silently moving with the browser clock; intervening writes may still change current-state membership. Existing `GET /api/tickets` gains optional `view=open|attention|recent-updated|recent-resolved` and `from`/`through` UTC timestamps only for recent views; `view` cannot combine with existing `status`, and invalid combinations return `400 INVALID_QUERY`. Existing search/sort/page behavior remains.

### GET /api/dashboard/staff

IT Staff/Administrator only; `200` response shape:

```json
{
  "data": {
    "asOf": "2026-10-31T10:00:00.000Z",
    "windowStart": "2026-10-25T00:00:00.000Z",
    "cards": { "unassignedTickets": 4, "myTickets": 2, "myActiveActions": 3 },
    "byStatus": { "NEW": 1, "OPEN": 2, "IN_PROGRESS": 1, "WAITING_FOR_REQUESTER": 1, "RESOLVED": 1, "CLOSED": 1, "REOPENED": 0, "CANCELLED": 0 },
    "byItPriority": { "LOW": 2, "MEDIUM": 2, "HIGH": 3 },
    "recentTickets": [{ "id": "UUID", "ticketNumber": "TKT-2026-000001", "summary": "Printer offline", "currentStatus": "OPEN", "itPriority": "HIGH", "updatedAt": "2026-10-30T09:00:00.000Z" }],
    "urgentTickets": [],
    "myActions": [{ "id": "UUID", "ticketId": "UUID", "ticketNumber": "TKT-2026-000001", "description": "Diagnose printer", "status": "PLANNED", "actionAt": "2026-11-01T02:00:00.000Z" }]
  }
}
```

Formulas and ordering are BR-28–30. `unassignedTickets` links to `/staff/tickets?view=unassigned`; `myTickets` to `?view=owned-by-me`; `myActiveActions` to `?view=my-active-actions`; `byStatus` to `?status=<enum>`; `byItPriority` to `?itPriority=<enum>`; recent to `?view=recent-updated&from=<windowStart>&through=<asOf>`; urgent to `?view=urgent`; Ticket rows to `/staff/tickets/:ticketId`; Action rows to `/staff/tickets/:ticketId#action-:actionId`. Existing `GET /api/staff/tickets` gains `view=unassigned|owned-by-me|my-active-actions|recent-updated|urgent`, with `from`/`through` required only for recent view and incompatible explicit owner/status/priority filters rejected as `400 INVALID_QUERY`. The `my-active-actions` view retains the inherited paginated TicketSummary response, returns each qualifying Ticket once, and adds a positive integer `matchingActionCount` to each row for Actions that meet BR-28; its `pagination.totalItems` counts unique Tickets rather than Actions. Administrator sees the same operational data, no account counts, and no existing Ticket write controls.

All dashboard list items have safe visible destinations; zero counts link to the same filtered empty view. A failed dashboard request returns no cached count as current data; the UI may keep prior data only if visibly marked stale and inaccessible to a different authenticated user.

## 6. Health and inherited routes

`GET /api/health` remains the Lab 1 public process-liveness endpoint and returns exactly `200 { "status": "ok", "service": "TokTickIT API" }` without querying PostgreSQL; a database outage is reported as safe `503 DEPENDENCY_UNAVAILABLE` by affected data endpoints. Health never includes user/Ticket/Action data, credentials, SQL, or stack traces. Lab 2/3 authentication, categories, related systems, Requester Ticket create/list/detail, Attachments, Public Comments, Requester resolution indication, Staff Queue/detail/assignees/claim/Owner/IT Priority/status/Internal Notes, and Administrator User Management endpoints keep their approved paths, shapes, authorization, and failure semantics except the specific filters and resolution gate above. Run their existing regression suites after each Lab 4 increment.
