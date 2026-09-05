# Lab 2 REST API Specification

Base URL: `/api`
Media type: `application/json` except multipart upload and binary download
Dates: UTC ISO 8601 strings

## 1. Shared conventions

Requester-scoped endpoints require `X-Requester-Id: <positive integer>`. This header carries the
Development Requester test context; it is not authentication. The server confirms that the Requester is
active and enforces Ticket/Attachment ownership. Missing, malformed, inactive, or unknown context returns
`400 INVALID_REQUESTER_CONTEXT`.

Successful collection objects use `data`; Ticket lists also use `pagination`. Errors are:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid.",
    "fields": { "summary": "Summary must contain 5–120 characters." }
  }
}
```

`fields` is present only for field validation. Messages are safe and contain no stack, SQL, absolute storage
path, checksum, or differently owned resource metadata.

| Status | Use |
| --- | --- |
| `200` | Successful retrieval, download metadata response, or soft removal |
| `201` | Ticket or Attachment created |
| `400` | Malformed context, JSON, path, or query parameter |
| `404` | Missing or differently owned resource (`RESOURCE_NOT_FOUND`) |
| `409` | State conflict such as already-removed Attachment |
| `410` | Owned Attachment exists but was removed |
| `413` | File exceeds 5 MB (5,242,880 bytes) |
| `415` | Unsupported or signature-mismatched file type |
| `422` | Semantically invalid fields or active Attachment limit |
| `500` | Safe unexpected error |
| `503` | Database/storage dependency unavailable |

## 2. Shared resource shapes

```ts
type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";
type TicketStatus = "NEW";
type ItPriority = "UNASSIGNED" | "LOW" | "MEDIUM" | "HIGH";

type ReferenceItem = { id: number; name: string };
type Requester = { id: number; displayName: string; email: string };

type AttachmentMetadata = {
  id: string;
  originalName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  sizeBytes: number;
  state: "ACTIVE" | "REMOVED";
  uploadedByDisplayName: string;
  createdAt: string;
  removedAt: string | null;
  removedByDisplayName: string | null;
  removalReason: string | null;
};
```

Storage names, paths, and checksums are never exposed.

## 3. Reference and Requester endpoints

### GET /api/requesters

Returns active Development Requesters sorted by `displayName asc, id asc`. No Requester header is needed.

- `200`: `{ "data": [{ "id": 1, "displayName": "Anan Chai", "email": "anan@example.test" }] }`
- `200` with no active records: `{ "data": [] }`
- `503`: `DEPENDENCY_UNAVAILABLE`

### GET /api/categories

Returns active Categories sorted by `name asc, id asc`.

- `200`: `{ "data": [{ "id": 1, "name": "Account and Access" }] }`
- `503`: `DEPENDENCY_UNAVAILABLE`

### GET /api/related-systems

Returns active Related Systems sorted by `name asc, id asc`.

- `200`: `{ "data": [{ "id": 1, "name": "Campus Wi-Fi" }] }`
- `503`: `DEPENDENCY_UNAVAILABLE`

## 4. Ticket creation

### POST /api/tickets

Headers: `Content-Type: application/json`, `X-Requester-Id`

Request body:

```json
{
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "  Laptop battery drains quickly  ",
  "requestedPriority": "MEDIUM",
  "description": "Battery falls from full to 20% within one hour."
}
```

`requesterId`, `ticketNumber`, `ticketDate`, `currentStatus`, and `itPriority` are forbidden as client-owned
values; the implementation shall reject protected fields with `400 MALFORMED_REQUEST`.

Validation:

- `categoryId` and `relatedSystemId`: required positive integers referencing active records.
- `summary`: required string; trim outer whitespace; 5–120 Unicode characters.
- `description`: required string; trim outer whitespace; 10–2,000 Unicode characters.
- `requestedPriority`: exactly `LOW`, `MEDIUM`, or `HIGH`.

`201`:

```json
{
  "data": {
    "id": "9abfbb47-0702-4f70-8462-66369a06d6bf",
    "ticketNumber": "TKT-20260906-000123",
    "ticketDate": "2026-09-06T03:12:00.000Z",
    "requester": { "id": 1, "displayName": "Anan Chai" },
    "category": { "id": 2, "name": "Hardware" },
    "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
    "summary": "Laptop battery drains quickly",
    "requestedPriority": "MEDIUM",
    "itPriority": "UNASSIGNED",
    "currentStatus": "NEW",
    "description": "Battery falls from full to 20% within one hour.",
    "createdAt": "2026-09-06T03:12:00.000Z",
    "updatedAt": "2026-09-06T03:12:00.000Z"
  }
}
```

`ticketDate` is the same authoritative timestamp as `createdAt`; the separate response name supports the
Ticket-screen label without storing duplicate date state.

Failures: `400` invalid context/body, `422 VALIDATION_ERROR` including inactive references, `503`
dependency unavailable, or safe `500`.

## 5. Ticket listing

### GET /api/tickets

Headers: `X-Requester-Id`

Query parameters:

| Name | Values/default | Behavior |
| --- | --- | --- |
| `search` | trimmed string, max 120; default empty | Case-insensitive Ticket Number or Summary contains |
| `categoryId` | positive integer | Exact active/reference ID filter |
| `relatedSystemId` | positive integer | Exact filter |
| `status` | `NEW` | Exact filter |
| `requestedPriority` | `LOW`, `MEDIUM`, `HIGH` | Exact filter |
| `sortBy` | `updatedAt`, `createdAt`, `ticketNumber`, `summary`; default `updatedAt` | Sort field |
| `sortOrder` | `asc`, `desc`; default `desc` | Sort direction |
| `page` | integer `>=1`; default `1` | One-based page |
| `pageSize` | `10`, `20`, `50`; default `10` | Items per page |

Unknown, duplicate, malformed, or unsupported query values return `400 INVALID_QUERY`; they are not
silently coerced. Search and filters combine with AND. Every sort appends `id` in the same direction as a
stable tie-breaker.

`200`:

```json
{
  "data": [
    {
      "id": "9abfbb47-0702-4f70-8462-66369a06d6bf",
      "ticketNumber": "TKT-20260906-000123",
      "summary": "Laptop battery drains quickly",
      "category": { "id": 2, "name": "Hardware" },
      "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
      "requestedPriority": "MEDIUM",
      "itPriority": "UNASSIGNED",
      "currentStatus": "NEW",
      "createdAt": "2026-09-06T03:12:00.000Z",
      "updatedAt": "2026-09-06T03:12:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

An empty page returns `data: []` with accurate metadata. A page above `totalPages` is valid and empty;
when `totalItems=0`, `totalPages=0`. Failures: `400`, `503`, `500`.

## 6. Owned Ticket detail

### GET /api/tickets/:ticketId

Headers: `X-Requester-Id`

`ticketId` must be a UUID. `200` returns the complete Ticket creation shape plus active and removed
Attachment metadata:

```json
{
  "data": {
    "id": "9abfbb47-0702-4f70-8462-66369a06d6bf",
    "ticketNumber": "TKT-20260906-000123",
    "ticketDate": "2026-09-06T03:12:00.000Z",
    "requester": { "id": 1, "displayName": "Anan Chai" },
    "category": { "id": 2, "name": "Hardware" },
    "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
    "summary": "Laptop battery drains quickly",
    "requestedPriority": "MEDIUM",
    "itPriority": "UNASSIGNED",
    "currentStatus": "NEW",
    "description": "Battery falls from full to 20% within one hour.",
    "createdAt": "2026-09-06T03:12:00.000Z",
    "updatedAt": "2026-09-06T03:12:00.000Z",
    "attachments": []
  }
}
```

Malformed UUID returns `400`. Missing and differently owned IDs both return identical
`404 RESOURCE_NOT_FOUND`. No response reveals whether another Requester owns the ID.

## 7. Attachments

### POST /api/tickets/:ticketId/attachments

Headers: `X-Requester-Id`; body: `multipart/form-data` with exactly one `file` part.

The server permits JPG/JPEG (`image/jpeg`), PNG (`image/png`), WEBP (`image/webp`), and PDF
(`application/pdf`), each no larger than 5 MB. Extension, declared MIME, and detected signature must agree.
The Ticket must have fewer than five active Attachments at commit time. Limits are enforced atomically to
handle concurrent uploads.

- `201`: `{ "data": <AttachmentMetadata with ACTIVE state> }`
- `400`: missing/multiple file parts or malformed Ticket ID
- `404`: Ticket missing/differently owned
- `413`: over 5 MB
- `415`: unsupported or mismatched type/signature
- `422 ATTACHMENT_LIMIT_REACHED`: sixth active file
- `503`: storage/database unavailable; staged bytes are cleaned up

### GET /api/tickets/:ticketId/attachments

Headers: `X-Requester-Id`

Returns all metadata for the owned Ticket, active first by `createdAt asc`, followed by removed records by
`removedAt desc`.

- `200`: `{ "data": [<AttachmentMetadata>] }`
- `400`: malformed Ticket ID
- `404`: Ticket missing/differently owned

### GET /api/attachments/:attachmentId/download

Headers: `X-Requester-Id`

For an active owned Attachment, returns `200` binary bytes with validated `Content-Type`,
`Content-Length`, `X-Content-Type-Options: nosniff`, and safe RFC 5987 `Content-Disposition` using the
original filename. Inline disposition is allowed for previewable images/PDF when `?disposition=inline`;
the only accepted values are `inline` and `attachment` (default).

Malformed ID returns `400`; missing/differently owned returns `404`; an owned removed Attachment returns
`410 ATTACHMENT_REMOVED`; missing storage bytes return safe `503 ATTACHMENT_UNAVAILABLE`.

### DELETE /api/attachments/:attachmentId

Headers: `Content-Type: application/json`, `X-Requester-Id`

Request body: `{ "reason": "The screenshot contains outdated information." }`

Reason is required, trimmed, and 10–250 characters. This operation records removal metadata and does not
hard-delete the database row.

- `200`: `{ "data": <AttachmentMetadata with REMOVED state> }`
- `400`: malformed ID/context/body
- `404`: missing/differently owned
- `409 ATTACHMENT_ALREADY_REMOVED`: owned record was already removed
- `422 VALIDATION_ERROR`: invalid reason
- `503`: dependency failure; state remains unchanged

## 8. Creation with initial files

Ticket JSON creation and file upload are deliberately separate endpoints. The client:

1. validates local files;
2. calls `POST /api/tickets`;
3. uploads each accepted file through `POST /api/tickets/:ticketId/attachments`;
4. reports complete or partial success.

The Ticket is authoritative once step 2 returns `201`. A later failed upload does not roll back it or prior
successful uploads. Each failed upload leaves no active metadata/file orphan and may be retried. This
compensation contract makes partial success observable and avoids deleting an official Ticket after its
number was shown.

## 9. Ownership and failure matrix

| Operation | Owned active | Missing/other owner | Owned removed |
| --- | --- | --- | --- |
| Ticket detail | `200` | `404` | n/a |
| Attachment metadata list | `200` | `404` Ticket | Metadata included |
| Attachment download | `200` | `404` | `410` |
| Attachment removal | `200` | `404` | `409` |

Unexpected exceptions are logged server-side with a correlation ID, while clients receive
`500 INTERNAL_ERROR` and a generic retry message. Database or storage outages use `503` when identified.
