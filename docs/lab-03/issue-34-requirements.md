# Issue #34 requirements — Authenticated Requester regression, Public Comments, and resolution indication

Status: Implementation and automated test evidence are tracked on `feature/34-requester-comments-resolution`; PR target: `lab3-staging`; depends on #33.

## Functional requirements

- FR-34-01: Requester Ticket creation, listing, detail, Attachment, Comment, and resolution-signal operations shall derive the Requester only from the authenticated session and shall ignore any client-supplied `requesterId` or `X-Requester-Id`.
- FR-34-02: `GET /api/tickets/:ticketId/comments` shall return Public Comments ordered by `createdAt asc, id asc` for the owning Requester, and for IT Staff and Administrators on any Ticket, with the identical `404 RESOURCE_NOT_FOUND` for a missing Ticket and a Ticket owned by another Requester.
- FR-34-03: `POST /api/tickets/:ticketId/comments` shall be available to the owning Requester and IT Staff only, shall require Origin and CSRF validation, shall accept only `content`, and shall take author and creation time from the backend.
- FR-34-04: Comment content shall be trimmed and must contain 1–2,000 Unicode characters; empty, whitespace-only, non-string, and over-limit content shall return `422 VALIDATION_ERROR` with a `fields.content` message and shall persist nothing.
- FR-34-05: Comment content shall be rendered by the client as escaped plain text with preserved line breaks, so injected markup or script is displayed literally and never executed.
- FR-34-06: Requesters shall have no read or write access to Internal Notes through the UI or direct API, and Internal Note content shall never appear in Requester Ticket Detail or comment responses.
- FR-34-07: `POST /api/tickets/:ticketId/problem-appears-resolved` shall accept only `{ version }`, require Origin and CSRF validation, and succeed only for the owning Requester while the Ticket is `WAITING_FOR_REQUESTER` and no signal exists.
- FR-34-08: A successful signal shall record `requesterResolvedAt` and `requesterResolvedByUserId`, increment `version`, leave `currentStatus` unchanged, and return the updated Ticket Detail.
- FR-34-09: Invalid state, repeated signal, and stale version shall return `409 INVALID_TICKET_STATE`, `409 RESOLUTION_ALREADY_INDICATED`, and `409 STALE_TICKET`; an invalid `version` shall return `422`; concurrent duplicate clicks shall produce exactly one success.
- FR-34-10: Requesters shall have no API path that sets a Ticket to Resolved or Closed, and Staff and Administrator callers shall receive `403` on the resolution-signal endpoint.
- FR-34-11: Requester Ticket Detail shall include `requesterResolvedAt` and `version` and shall otherwise keep the Lab 2 shape and ownership-safe behavior.
- FR-34-12: The Requester UI shall provide Create Ticket (client validation matching the server limits, session-derived identity, no requester field), My Tickets, and Ticket Detail with Public Comments, a confirmed `Problem appears resolved` action shown only when permitted, and loading, empty, validation, busy, success, conflict, not-found, and safe-failure states, with no Development Requester selector, Change Requester action, or persisted selected-requester state.

## Test mapping

| Test ID | Automated evidence | Expected result |
| --- | --- | --- |
| API-05 | `server/tests/lab-03/comments-notes.api.test.ts` | Owned and cross-owner retrieval, valid/empty/whitespace/over-limit/boundary creation, backend author and time, forged fields, CSRF, role matrix, literal markup storage, and Requester Internal Note denial and non-leakage. |
| API-06 | `server/tests/lab-03/requester-resolution.api.test.ts` | Happy path without status change, repeat, concurrency, wrong status, stale and invalid version, cross-owner equivalence, role and CSRF denial, and no formal resolve or close path. |
| SEC-02 | `server/tests/lab-03/authorization.api.test.ts` and the migrated Lab 2 suites | Session-derived identity, forged identity ignored, and Attachment and Ticket regression continue to pass. |
| UI-04 | `client/tests/lab-03/RequesterTicketDetail.test.tsx`, `client/tests/lab-03/RequesterCreateTicket.test.tsx` | Loading, empty, safe text rendering, comment validation, busy and failure, confirmation, conflict, hidden action, not-found, retry, My Tickets list and empty state, and absence of Internal Note and Staff controls. |

## Scope boundary

This issue does not add Internal Notes, Staff status transitions, IT Priority or ownership changes, the Staff Queue, or Administrator functions. My Tickets filter, sort, and pagination controls and Attachment upload/remove controls are not added here, and screenshots and Playwright E2E belong to #39 and #40.
