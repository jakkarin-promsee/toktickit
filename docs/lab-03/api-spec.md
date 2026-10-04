# Lab 3 REST API Specification

Status: Approved REST contract from Issue #30 (PR #42), implemented by Issues #32–#37 and verified by the API, security, and E2E suites listed in `tests.md`

Base URL: `/api`

Media type: `application/json` except multipart Attachment upload and binary Attachment download

Dates: UTC ISO 8601 strings

## 1. Authentication, cookies, CSRF, and request gates

Successful login and password change set `toktickit_session=<opaque 256-bit token>` with `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`; production HTTPS also requires `Secure`. The database stores only the SHA-256 token hash. Sessions expire absolutely after eight hours and are never extended by activity.

Successful login, current-user retrieval, and password change return the current session's 64-character random `csrfToken` in JSON. The client keeps this token in memory and obtains it again through `GET /api/auth/me` after a page reload. Every unsafe authenticated `POST`, `PATCH`, or `DELETE` requires `X-CSRF-Token` equal to the session token and an exact allowed `Origin`; safe `GET`/`HEAD` requests require the session but not the CSRF header. Login validates Origin but needs no session or CSRF header.

Request processing uses this gate order: parse path/request framing needed to route safely; authenticate the session; enforce mandatory password change; authorize role; resolve resource with ownership-safe lookup; validate request/query semantics; enforce state/version conflicts; mutate. A User with `mustChangePassword=true` may call only `GET /api/auth/me`, `POST /api/auth/change-password`, and `POST /api/auth/logout`; other protected requests return `403 PASSWORD_CHANGE_REQUIRED`.

All Lab 2 uses of `X-Requester-Id` are removed. If `X-Requester-Id` or a protected client-owned `requesterId`, `submittedByUserId`, `authorId`, or mutation actor field is supplied, the server returns `400 MALFORMED_REQUEST`; identity always comes from the authenticated session.

## 2. Shared response and error contract

Successful resources use `{ "data": ... }`; `204` responses have no body. Collection pagination uses a sibling `pagination` object. Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid.",
    "fields": {
      "displayName": "Display name must contain 2–100 characters."
    }
  }
}
```

`fields` appears only for field validation. Error messages never contain passwords, password/session hashes, CSRF tokens, stack traces, SQL, filesystem paths, storage names, checksums, or another Requester's protected resource metadata/existence.

| Status | Shared use |
| --- | --- |
| `200` | Successful retrieval or update with a response body |
| `201` | User, Ticket, Attachment, Public Comment, or Internal Note created |
| `204` | Successful logout or initial-password reset with no body |
| `400` | Malformed JSON, multipart body, path identifier, forbidden client-owned field, or invalid/unknown/duplicate query parameter |
| `401` | Missing, invalid, expired, or revoked session; invalid login credentials use generic `AUTHENTICATION_FAILED` |
| `403` | Password change required, invalid Origin/CSRF, or authenticated role forbidden before protected resource lookup |
| `404` | Missing resource or Requester cross-owner resource using `RESOURCE_NOT_FOUND` |
| `409` | Duplicate email, stale version, invalid state transition, assignment conflict, or Administrator safety conflict |
| `410` | Owned Attachment exists but its bytes were soft-removed |
| `413` | Attachment exceeds 5 MB |
| `415` | Attachment type, extension, MIME, or signature is unsupported/incoherent |
| `422` | Well-formed request has invalid field values or violates the active Attachment limit |
| `429` | Login threshold exceeded; response includes integer-seconds `Retry-After` |
| `500` | Safe unexpected internal failure |
| `503` | Identified database or file-storage dependency unavailable |

For Requester-owned Ticket, Attachment, and Public Comment operations, missing and differently owned identifiers return the identical `404 RESOURCE_NOT_FOUND`. Requests to Staff, Internal Note, or Administrator endpoint families by an unauthorized role return `403 FORBIDDEN` before resource lookup.

## 3. Shared resource shapes

```ts
type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";
type ItPriority = "LOW" | "MEDIUM" | "HIGH";
type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";

type SafeCurrentUser = {
  id: number;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: true;
  mustChangePassword: boolean;
  sessionExpiresAt: string;
  csrfToken: string;
};

type UserSummary = {
  id: number;
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type PersonReference = { id: number; displayName: string; role?: UserRole };
type ReferenceItem = { id: number; name: string };

type AttachmentMetadata = {
  id: string;
  originalName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  sizeBytes: number;
  state: "ACTIVE" | "REMOVED";
  uploadedBy: PersonReference;
  createdAt: string;
  removedAt: string | null;
  removedBy: PersonReference | null;
  removalReason: string | null;
};

type PublicComment = { id: string; content: string; author: PersonReference; createdAt: string };
type InternalNote = { id: string; content: string; author: PersonReference; createdAt: string };

type TicketSummary = {
  id: string;
  ticketNumber: string;
  summary: string;
  requester: PersonReference;
  category: ReferenceItem;
  relatedSystem: ReferenceItem;
  requestedPriority: RequestedPriority;
  itPriority: ItPriority;
  currentStatus: TicketStatus;
  owner: PersonReference | null;
  requesterResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

type TicketDetail = TicketSummary & {
  ticketDate: string;
  description: string;
  requesterResolvedBy: PersonReference | null;
  lastStatusChangedAt: string | null;
  lastStatusChangedBy: PersonReference | null;
  lastOwnerChangedAt: string | null;
  lastOwnerChangedBy: PersonReference | null;
  lastPriorityChangedAt: string | null;
  lastPriorityChangedBy: PersonReference | null;
  attachments: AttachmentMetadata[];
};

type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};
```

Storage names, paths, checksums, password hashes, session hashes, and credential state beyond `mustChangePassword` are never exposed.

## 4. Authentication endpoints

### POST /api/auth/login

Authorization: public; requires an allowed Origin; an existing cookie is ignored and replaced only on success.

Request: `{ "email": " user@example.test ", "password": "Example!Pass123" }`. Email is trimmed/lowercased and limited to 254 characters. Password must be a string no longer than 128 characters; password-policy composition is enforced when setting a password, while login compares the supplied value exactly.

`200`: `{ "data": <SafeCurrentUser> }` plus the session cookie. `mustChangePassword` tells the client whether to route exclusively to Change Password.

Failures: `400 MALFORMED_REQUEST` for missing/non-string/oversized framing; `401 AUTHENTICATION_FAILED` with `Sign-in failed. Check your credentials or account status.` for unknown email, wrong password, inactive User, or missing Credential; `429 TOO_MANY_ATTEMPTS` after five failed attempts for normalized email plus IP in 15 minutes; safe `500/503`.

### POST /api/auth/logout

Authorization: current session when present; a live session requires allowed Origin and valid `X-CSRF-Token`. With no valid live session, the endpoint remains idempotent and clears the cookie without revealing session state.

Request: no body. `204`: current Session is revoked when resolvable and the cookie is expired. Failures for a live session are `403 CSRF_INVALID`; identified dependency failure returns `503` without claiming revocation succeeded.

### GET /api/auth/me

Authorization: any active authenticated User, including `mustChangePassword=true`.

`200`: `{ "data": <SafeCurrentUser> }`. Failures: `401 AUTHENTICATION_REQUIRED` for missing/invalid/expired/revoked session or inactive User; safe `500/503`.

### POST /api/auth/change-password

Authorization: any active authenticated User, including `mustChangePassword=true`; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "currentPassword": "Example!Pass123", "newPassword": "Different!Pass456" }`. Both are required strings; new password is 12–128 characters, contains lowercase, uppercase, digit, and symbol, and differs from the verified current password.

`200`: `{ "data": <SafeCurrentUser with mustChangePassword false and new csrfToken/expiration> }` plus a rotated cookie. The change hashes the new password, clears `mustChangePassword`, revokes all old Sessions, and creates one replacement Session atomically.

Failures: `400 MALFORMED_REQUEST`; `401 AUTHENTICATION_REQUIRED`; `403 CSRF_INVALID`; `422 VALIDATION_ERROR` for wrong current password, password-policy failure, or same password using field-safe messages; safe `500/503` with old credential/session state retained.

## 5. Authenticated reference endpoints

### GET /api/categories

Authorization: any authenticated User who has completed mandatory password change.

`200`: `{ "data": [{ "id": 1, "name": "Account and Access" }] }`, containing active records ordered by `name asc, id asc`. Failures: `401`, `403 PASSWORD_CHANGE_REQUIRED`, safe `500/503`.

### GET /api/related-systems

Authorization: any authenticated User who has completed mandatory password change.

`200`: `{ "data": [{ "id": 1, "name": "Campus Wi-Fi" }] }`, containing active records ordered by `name asc, id asc`. Failures: `401`, `403 PASSWORD_CHANGE_REQUIRED`, safe `500/503`.

## 6. Requester Ticket endpoints

### POST /api/tickets

Authorization: Requester; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "categoryId": 2, "relatedSystemId": 7, "summary": "Laptop battery drains quickly", "requestedPriority": "MEDIUM", "description": "Battery falls from full to 20% within one hour." }`. Lab 2 rules remain: active positive reference IDs; trimmed Summary 5–120 Unicode characters; trimmed Description 10–2,000; Requested Priority exactly LOW/MEDIUM/HIGH; protected owner/status/priority/identity fields rejected.

`201`: `{ "data": <TicketDetail> }` with authenticated submitter, backend Ticket Number/date, `currentStatus="NEW"`, `itPriority` equal to Requested Priority, null owner, version zero, and no Attachments.

Failures: `400` malformed/protected fields; `401/403`; `422 VALIDATION_ERROR`; safe `500/503`. No Ticket persists on failure.

### GET /api/tickets

Authorization: Requester; returns only authenticated submitter's Tickets.

Query retains Lab 2 behavior: `search` up to 120 characters over Ticket Number/Summary; optional `categoryId`, `relatedSystemId`, `status`, and `requestedPriority`; `sortBy=updatedAt|createdAt|ticketNumber|summary`; `sortOrder=asc|desc`; `page>=1`; `pageSize=10|20|50`; defaults are `updatedAt desc`, page 1, size 10. Unknown, duplicate, malformed, or unsupported query values return `400 INVALID_QUERY`. Criteria combine with AND and `id` is the same-direction tie-breaker.

`200`: `{ "data": [<TicketSummary>], "pagination": <Pagination> }`. Beyond-end pages are valid and empty; zero matches means `totalPages=0`. Failures: `400`, `401/403`, safe `500/503`.

### GET /api/tickets/:ticketId

Authorization: Requester owning the Ticket.

`ticketId` must be UUID. `200`: `{ "data": <TicketDetail> }`. Failures: `400` malformed UUID; `401/403`; identical `404 RESOURCE_NOT_FOUND` for missing/other owner; safe `500/503`.

### POST /api/tickets/:ticketId/problem-appears-resolved

Authorization: Requester owning the Ticket; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "version": 3 }` after UI confirmation. Version is a non-negative integer.

`200`: `{ "data": <TicketDetail> }` with requester-resolution actor/time recorded, unchanged `WAITING_FOR_REQUESTER` status, and incremented version.

Failures: `400` malformed ID/body; `401/403`; `404` missing/other owner; `409 INVALID_TICKET_STATE` unless Waiting for Requester, `409 RESOLUTION_ALREADY_INDICATED`, or `409 STALE_TICKET`; `422` invalid version; safe `500/503`.

## 7. Attachment endpoints

### POST /api/tickets/:ticketId/attachments

Authorization: Requester owning the Ticket; requires allowed Origin and `X-CSRF-Token`; multipart body contains exactly one `file` part.

JPG/JPEG, PNG, WEBP, and PDF are permitted when extension, declared MIME, and detected signature agree. Maximum size is 5 MB (5,242,880 bytes), with at most five active Attachments committed atomically. The backend authors uploader/time and uses generated private storage names.

`201`: `{ "data": <AttachmentMetadata with ACTIVE state> }`. Failures: `400` malformed ID/body; `401/403`; `404` missing/other-owner Ticket; `413`; `415`; `422 ATTACHMENT_LIMIT_REACHED`; safe `500/503` with staged bytes cleaned and no active orphan.

### GET /api/tickets/:ticketId/attachments

Authorization: Requester owning the Ticket, or IT Staff/Administrator reading any Ticket.

`200`: `{ "data": [<AttachmentMetadata>] }`, active records by `createdAt asc, id asc` followed by removed records by `removedAt desc, id desc`. Failures: `400` malformed ID; `401/403`; Requester-safe `404` for missing/other owner and ordinary `404` for Staff/Administrator missing Ticket; safe `500/503`.

### GET /api/attachments/:attachmentId/download

Authorization: Requester owning the parent Ticket, or IT Staff/Administrator reading any Ticket.

Query accepts optional single `disposition=inline|attachment`, default `attachment`. An active Attachment returns `200` bytes with validated `Content-Type`, `Content-Length`, `X-Content-Type-Options: nosniff`, and safe RFC 5987 `Content-Disposition` based on original filename.

Failures: `400` malformed ID/query; `401/403`; Requester-safe `404` for missing/other owner; `410 ATTACHMENT_REMOVED` for a visible removed record; `503 ATTACHMENT_UNAVAILABLE` for missing stored bytes; safe `500/503`.

### DELETE /api/attachments/:attachmentId

Authorization: Requester owning the parent Ticket; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "reason": "The screenshot contains outdated information." }`; reason is trimmed and 10–250 Unicode characters.

`200`: `{ "data": <AttachmentMetadata with REMOVED state> }`. Failures: `400`; `401/403`; `404` missing/other owner; `409 ATTACHMENT_ALREADY_REMOVED`; `422 VALIDATION_ERROR`; safe `500/503` with state unchanged.

## 8. Public Comment endpoints

### GET /api/tickets/:ticketId/comments

Authorization: Requester owning the Ticket, or IT Staff/Administrator reading any Ticket.

`200`: `{ "data": [<PublicComment>] }`, ordered `createdAt asc, id asc`. Failures: `400` malformed ID; `401/403`; Requester-safe `404` for missing/other owner; ordinary `404` for Staff/Administrator missing Ticket; safe `500/503`.

### POST /api/tickets/:ticketId/comments

Authorization: Requester owning the Ticket or IT Staff on any Ticket; Administrator is forbidden; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "content": "Please try signing in again and tell us the result." }`. Content is trimmed, 1–2,000 Unicode characters, stored as plain text, and backend-authored/timestamped; `authorId`, HTML mode, edit, and delete fields are forbidden.

`201`: `{ "data": <PublicComment> }`. Failures: `400`; `401/403`; Requester-safe `404` for missing/other owner; ordinary `404` for Staff missing Ticket; `422 VALIDATION_ERROR`; safe `500/503` with no entry persisted.

## 9. Staff Queue and Ticket Detail endpoints

### GET /api/staff/tickets

Authorization: IT Staff read/write or Administrator read-only.

Query parameters:

| Name | Values/default | Behavior |
| --- | --- | --- |
| `search` | Trimmed string up to 120; default empty | Case-insensitive contains over Ticket Number, Summary, Requester display name, or Requester email |
| `categoryId` | Positive integer | Exact Category filter |
| `relatedSystemId` | Positive integer | Exact Related System filter |
| `status` | Any TicketStatus | Exact status filter |
| `requestedPriority` | LOW, MEDIUM, HIGH | Exact Requested Priority filter |
| `itPriority` | LOW, MEDIUM, HIGH | Exact IT Priority filter |
| `owner` | `me`, `unassigned`, or positive User ID | Authenticated User, null owner, or exact eligible owner filter |
| `sortBy` | `updatedAt`, `createdAt`, `ticketNumber`, `requestedPriority`, `itPriority`, `status`; default `updatedAt` | Primary sort field |
| `sortOrder` | `asc`, `desc`; default `desc` | Primary and `id` tie-breaker direction |
| `page` | Integer >=1; default 1 | One-based page |
| `pageSize` | 10, 20, 50; default 20 | Items per page |

Unknown, duplicate, malformed, inactive-reference, or unsupported values return `400 INVALID_QUERY`; criteria combine with AND. `owner=me` is valid for IT Staff and returns their queue; for Administrator it is accepted but normally empty unless that Administrator owns Tickets.

`200`: `{ "data": [<TicketSummary>], "pagination": <Pagination>, "counts": { "total": 42, "unassigned": 6, "mine": 9 } }`. Counts ignore active search/filters and describe all Tickets visible to the authenticated User; Administrator `mine` counts owned Tickets despite read-only behavior. Failures: `400`, `401/403`, safe `500/503`.

### GET /api/staff/tickets/:ticketId

Authorization: IT Staff read/write or Administrator read-only.

`200`: `{ "data": { ...<TicketDetail>, "publicComments": [<PublicComment>], "internalNotes": [<InternalNote>] } }`. Failures: `400` malformed UUID; `401/403`; `404 RESOURCE_NOT_FOUND`; safe `500/503`.

### GET /api/staff/assignees

Authorization: IT Staff; Administrator is forbidden because no Administrator assignment UI is permitted.

`200`: `{ "data": [{ "id": 8, "displayName": "Narin Support", "role": "IT_STAFF" }, { "id": 12, "displayName": "Araya Admin", "role": "ADMINISTRATOR" }] }`, containing active IT Staff and Administrator Users ordered by `displayName asc, id asc`. Failures: `401/403`; safe `500/503`.

### POST /api/staff/tickets/:ticketId/claim

Authorization: IT Staff; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "version": 2 }`. `200`: `{ "data": <TicketDetail> }` with owner set to the authenticated IT Staff, actor/time recorded, and version incremented.

Failures: `400`; `401/403`; `404`; `409 TICKET_ALREADY_ASSIGNED`; `409 STALE_TICKET`; `422` invalid version; safe `500/503`.

### PATCH /api/staff/tickets/:ticketId/owner

Authorization: IT Staff; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "ownerId": 12, "version": 3 }` after confirmation when replacing a non-null different owner. `ownerId` must reference an active IT Staff or Administrator User; null/unassign is not part of Lab 3.

`200`: `{ "data": <TicketDetail> }` with owner, actor/time, and incremented version. Failures: `400`; `401/403`; `404` Ticket; `409 STALE_TICKET`; `422 VALIDATION_ERROR` for missing/inactive/ineligible owner or invalid version; safe `500/503`.

### PATCH /api/staff/tickets/:ticketId/it-priority

Authorization: IT Staff; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "itPriority": "HIGH", "version": 4 }`. Requested Priority is not accepted and cannot change.

`200`: `{ "data": <TicketDetail> }` with IT Priority, actor/time, and incremented version. Failures: `400`; `401/403`; `404`; `409 STALE_TICKET`; `422 VALIDATION_ERROR`; safe `500/503`.

### PATCH /api/staff/tickets/:ticketId/status

Authorization: IT Staff; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "status": "RESOLVED", "version": 5 }` after any confirmation required by the status matrix. Only exact enum target values are accepted.

`200`: `{ "data": <TicketDetail> }` with status, signal clearing where required, actor/time, and incremented version. Failures: `400`; `401/403`; `404`; `409 INVALID_STATUS_TRANSITION`; `409 OWNER_REQUIRED`; `409 STALE_TICKET`; `422 VALIDATION_ERROR`; safe `500/503`. Actions Taken is never validated in Lab 3.

### GET /api/staff/tickets/:ticketId/internal-notes

Authorization: IT Staff or Administrator read-only.

`200`: `{ "data": [<InternalNote>] }`, ordered `createdAt asc, id asc`. A Requester receives `403 FORBIDDEN` before Ticket lookup and no note data/count/hint. Other failures: `400`, `401`, `404` for permitted roles, safe `500/503`.

### POST /api/staff/tickets/:ticketId/internal-notes

Authorization: IT Staff; Administrator and Requester are forbidden; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "content": "Checked authentication logs; no sensitive values copied." }`. Content is trimmed, 1–2,000 Unicode characters, stored as plain text, and backend-authored/timestamped.

`201`: `{ "data": <InternalNote> }`. Failures: `400`; `401/403` before Ticket lookup for denied roles; `404` missing Ticket for IT Staff; `422 VALIDATION_ERROR`; safe `500/503` with no entry persisted.

## 10. Administrator User Management endpoints

### GET /api/admin/users

Authorization: Administrator.

Query: optional `search` trimmed up to 120 characters over display name/email and optional single `role=REQUESTER|IT_STAFF|ADMINISTRATOR`. Unknown, duplicate, malformed, or unsupported values return `400 INVALID_QUERY`. Criteria combine with AND. No pagination or sort query is supported; results order by `displayName asc, id asc`.

`200`: `{ "data": [<UserSummary>] }`. Failures: `400`, `401/403`, safe `500/503`.

### POST /api/admin/users

Authorization: Administrator; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "displayName": "Pim Support", "email": "pim@example.test", "role": "IT_STAFF", "isActive": true, "initialPassword": "Example!Pass123" }`. Display name is trimmed 2–100 Unicode characters; email follows normalization/uniqueness rules; role is exactly one permitted enum; `isActive` is Boolean; initial password follows the 12–128 composition rules.

`201`: `{ "data": <UserSummary with mustChangePassword true> }`. Password/hash are omitted. Failures: `400`; `401/403`; `409 EMAIL_ALREADY_EXISTS`; `422 VALIDATION_ERROR`; safe `500/503` with no partial User/Credential.

### PATCH /api/admin/users/:userId

Authorization: Administrator; requires allowed Origin and `X-CSRF-Token`.

Request contains the complete editable set: `{ "displayName": "Pim Support", "email": "pim@example.test", "role": "IT_STAFF", "isActive": true, "version": 2 }`. `userId` is a positive integer. Missing editable fields are malformed rather than interpreted as partial defaults.

`200`: `{ "data": <UserSummary> }`. Email, role, or activation changes revoke all target Sessions; name-only changes do not. Failures: `400`; `401/403`; `404 USER_NOT_FOUND`; `409 EMAIL_ALREADY_EXISTS`; `409 SELF_ADMIN_CHANGE_FORBIDDEN` for own deactivation or role change; `409 LAST_ACTIVE_ADMINISTRATOR`; `409 USER_OWNS_TICKETS` when deactivation or Requester role would make existing ownership invalid; `409 STALE_USER`; `422 VALIDATION_ERROR`; safe `500/503` with state unchanged.

### POST /api/admin/users/:userId/initial-password

Authorization: Administrator; requires allowed Origin and `X-CSRF-Token`.

Request: `{ "initialPassword": "Different!Pass456" }`; password follows the 12–128 composition rules. The server hashes it, sets `mustChangePassword=true`, and revokes all target Sessions atomically.

`204`: no body. Failures: `400`; `401/403`; `404 USER_NOT_FOUND`; `422 VALIDATION_ERROR`; safe `500/503` with old credential/session state retained.

## 11. Concurrency, transaction, and failure behavior

- Ticket claim, owner, IT Priority, status, and requester-resolution mutations compare the submitted `version` and increment it in the same database transaction; zero matched rows after an otherwise valid lookup returns `409 STALE_TICKET`.
- User edit compares `version`, applies last-active-Administrator/current-owner checks and the update in one transaction, increments version, and revokes required Sessions only if the update commits.
- User creation and initial-password reset write User/Credential/session changes atomically; credential or session failure never leaves a plaintext value or falsely successful response.
- Comment and Note creation writes one immutable row in one transaction; retry after an ambiguous network failure may create a second entry because general idempotency keys are outside scope, so the UI disables duplicate submission while pending.
- Attachment staging, atomic active-count enforcement, cleanup, partial Ticket-creation upload behavior, removal, and unavailable-byte handling remain exactly as specified for Lab 2 with authenticated ownership replacing the Requester header.
- Expected dependency outages use `503 DEPENDENCY_UNAVAILABLE`; unexpected exceptions are logged server-side with redacted context and return `500 INTERNAL_ERROR`.
