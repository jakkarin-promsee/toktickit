# Issue #15 — Requester-owned Ticket Detail Requirements

Status: Implemented, merged, and verified in the final Issue #17 integration suite

## Goal

Allow the selected Development Requester to open one of their own Tickets from My Tickets and inspect its complete read-only information without exposing tickets owned by another Requester.

## Scope

- Add `GET /api/tickets/:ticketId` with active Development Requester context validation and backend ownership enforcement.
- Return the complete Ticket creation shape plus Attachment metadata for the owned Ticket.
- Add a read-only Requester Ticket Detail screen with loading, safe not-found/denied, and unexpected-failure states.
- Connect My Tickets View ticket actions to the detail screen and provide navigation back to My Tickets.
- Preserve the selected Requester context on refresh and direct detail navigation.

## Out of scope

- Attachment upload, download, preview, or removal mutations.
- Ticket field editing, comments, internal notes, Actions Taken, IT Priority actions, status transitions, authentication, and real authorization.

## Functional requirements

- **FR-15-01 — Owned detail API:** `GET /api/tickets/:ticketId` requires a valid active `X-Requester-Id` and returns only a Ticket owned by that Requester.
- **FR-15-02 — Path validation:** The endpoint rejects a malformed Ticket UUID with `400 INVALID_TICKET_ID`.
- **FR-15-03 — Safe ownership behavior:** A missing Ticket and a Ticket owned by another Requester return the same `404 RESOURCE_NOT_FOUND` response without revealing ownership or Ticket data.
- **FR-15-04 — Detail response:** An owned response includes the Ticket ID, official Ticket Number, Ticket Date, Requester, Category, Related System, Summary, Requested Priority, IT Priority, Current Status, Description, timestamps, and Attachment metadata.
- **FR-15-05 — Attachment metadata:** Detail returns active and removed Attachment metadata without exposing storage names, paths, checksums, or file bytes.
- **FR-15-06 — Read-only UI:** Ticket fields are displayed as read-only text or read-only controls and no edit or status workflow controls are rendered.
- **FR-15-07 — Navigation:** A Requester can open detail from My Tickets and return to My Tickets without losing the selected Requester context.
- **FR-15-08 — UI states:** Detail exposes loading, safe not-found/denied, unexpected-failure, and successful owned states.
- **FR-15-09 — Direct navigation:** Refreshing or opening a direct detail URL still requires and sends the selected Requester context.
- **FR-15-10 — Responsive layout:** Desktop, tablet, and mobile detail layouts do not clip labels, overlap content, or introduce horizontal page overflow.

## API contract

### Request

```text
GET /api/tickets/:ticketId
X-Requester-Id: <positive active requester id>
```

The `ticketId` path value must be a UUID.

### Success response

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

Attachment metadata includes only the public fields defined by `api-spec.md`; storage names, paths, checksums, and binary content are never returned.

### Error behavior

- `400 INVALID_REQUESTER_CONTEXT` for missing, malformed, inactive, or unknown Requester context.
- `400 INVALID_TICKET_ID` for a malformed Ticket UUID.
- `404 RESOURCE_NOT_FOUND` with the same safe body for a missing or differently owned Ticket.
- `503 DEPENDENCY_UNAVAILABLE` for identified database dependency failures.
- `500 INTERNAL_ERROR` for other unexpected failures without internal details.

## Acceptance criteria

- **AC-15-01:** Given an active Requester-owned Ticket, when the Requester opens its detail endpoint, then the complete read-only Ticket response is returned with Attachment metadata.
- **AC-15-02:** Given a Ticket owned by another Requester, when the selected Requester requests it directly, then no Ticket data is returned and the response is identical to a missing Ticket response.
- **AC-15-03:** Given a malformed or missing Ticket ID, when detail is requested, then a safe documented error is returned without a server exception leaking to the client.
- **AC-15-04:** Given an owned Ticket, when the detail screen loads, then required Ticket fields are readable, grouped separately from Attachments, and no excluded workflow controls are present.
- **AC-15-05:** Given loading, safe not-found/denied, or unexpected API failure, when the detail screen renders, then the corresponding actionable state is shown without internal error details.
- **AC-15-06:** Given a Ticket opened from My Tickets or a direct detail URL, when the user navigates or refreshes, then the selected Requester context remains enforced and the user can return to My Tickets.
- **AC-15-07:** Given desktop, tablet, or mobile viewport sizes, when the detail screen is displayed, then labels and controls remain readable without clipping, overlap, or horizontal overflow.

## Test-first implementation checklist

- [x] Add API tests for owned detail, complete response shape, attachment metadata, malformed ID, missing ID, cross-requester access, invalid context, and safe failures.
- [x] Add UI tests for loading, owned read-only detail, attachment separation, navigation, not-found, failure, forbidden controls, and requester context headers.
- [x] Add responsive assertions for the detail layout and direct navigation behavior.
- [x] Implement the API and UI only after the new tests fail for the expected missing-feature reason.
