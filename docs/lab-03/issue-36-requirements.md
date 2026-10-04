# Issue #36 requirements — IT Staff Ticket Detail and operational workflow

Status: Implementation and automated test evidence are tracked on `feature/36-staff-ticket-operations`; PR target: `lab3-staging`; depends on #35.

## Functional requirements

- FR-36-01: `GET /api/staff/tickets/:ticketId` shall return the full grouped Ticket Detail (requester, classification, priorities, owner, requester-resolution signal, last-change actors and times, Attachments, Public Comments, and Internal Notes) to IT Staff and read-only Administrators, and Requesters shall receive `403` before any lookup.
- FR-36-02: `POST /api/staff/tickets/:ticketId/claim` shall assign the authenticated IT Staff user only when the Ticket has no owner, and an already assigned Ticket shall return `409 TICKET_ALREADY_ASSIGNED`.
- FR-36-03: `PATCH /api/staff/tickets/:ticketId/owner` shall assign or reassign only to an active IT Staff or Administrator user, reject inactive, Requester, unknown, or current owners with `422 VALIDATION_ERROR`, and require `confirmed: true` when replacing an existing owner.
- FR-36-04: `GET /api/staff/assignees` shall list active IT Staff and Administrator users ordered by display name and shall be available to IT Staff only.
- FR-36-05: `PATCH /api/staff/tickets/:ticketId/it-priority` shall change only IT Priority to `LOW`, `MEDIUM`, or `HIGH`, shall never accept or change Requested Priority, and shall record the actor and time.
- FR-36-06: `PATCH /api/staff/tickets/:ticketId/status` shall accept only the 19 transitions in the approved matrix, return `409 INVALID_STATUS_TRANSITION` for every other pair, return `409 OWNER_REQUIRED` when the matrix needs an eligible owner, and require `confirmed: true` for Resolved, Closed, Cancelled, and Reopened targets.
- FR-36-07: Moving to In Progress from Waiting for Requester, moving to Waiting for Requester, and reopening shall clear the requester-resolution signal, while Resolved and Cancelled shall leave it intact, and Actions Taken shall never be checked.
- FR-36-08: Owner, priority, and status mutations shall require IT Staff, an allowed Origin, and the CSRF token, shall require an integer `version`, shall apply one conditional write so concurrent or stale requests return `409 STALE_TICKET`, shall increment `version`, and shall change nothing on failure.
- FR-36-09: Administrators and Requesters shall receive `403` on every Staff mutation, so Administrator visibility does not grant claim, assignment, priority, status, comment, or note permissions.
- FR-36-10: `GET /api/staff/tickets/:ticketId/internal-notes` shall be available to IT Staff and Administrators, `POST` shall be available to IT Staff only, content shall be trimmed to 1–2,000 characters, author and time shall come from the backend, forged fields shall return `400`, and no edit or delete endpoint shall exist.
- FR-36-11: IT Staff shall be able to post Public Comments on any Ticket through the existing comment endpoint, and the owning Requester shall see them.
- FR-36-12: The Staff Ticket Detail screen shall group read-only Ticket information separately from the Ownership, Priority, and Status cards, shall style editable and read-only values differently, and shall show only matrix-allowed next statuses with `Assign an owner first` where an owner is required.
- FR-36-13: Reassignment and Resolved, Closed, Cancelled, and Reopened transitions shall use a confirmation dialog naming the subject, and stale conflicts shall show `This Ticket changed. Refresh before trying again.` with Refresh while preserving drafts and selections.
- FR-36-14: Public Comments, Internal Notes, and Attachments shall be separate tabs, Internal Notes shall use the amber locked surface with the label `Visible only to IT Staff and Administrators`, the public composer shall warn that the requester will see the comment, and drafts shall be kept independently per tab.
- FR-36-15: Attachments shall be listed with download links for IT Staff and shall offer no upload or remove controls, and a read-only mode shall render no mutation or composer controls.
- FR-36-16: The detail screen shall provide loading, not-found, forbidden, validation, success, conflict, and safe-failure (with Retry) states.

## Contract note

The API specification shows status and owner request bodies without a confirmation field, while BR-24 and BR-20 require confirmation to be enforced. This issue implements the confirmation as an optional boolean `confirmed` request field that the backend requires for the confirmation-required transitions and for replacing an existing owner.

## Test mapping

| Test ID | Automated evidence | Expected result |
| --- | --- | --- |
| UNIT-04 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` and `client/tests/lab-03/StaffTicketDetail.test.tsx` | The matrix contains exactly the approved pairs and flags on both server and client. |
| API-08 to API-11 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Detail retrieval, claim, assign, reassign, concurrency, IT Priority, every matrix and non-matrix pair, confirmation, owner rules, signal clearing, Internal Notes, role denial, and non-mutation on failure. |
| API-05 | `server/tests/lab-03/comments-notes.api.test.ts` and `staff-ticket-detail.api.test.ts` | Staff Public Comments are visible to the Requester, and Administrators are read-only. |
| UI-06 | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Grouping, claim, confirmed reassignment, read-only Requested Priority, matrix-only status buttons, stale conflict with preserved drafts, Public/Internal separation, validation, failure, Attachments, and safe states. |

## Scope boundary

This issue does not add Actions Taken, SLA or notifications, User Management, editing or deleting comments or notes, or Attachment upload and removal for Staff. The Administrator read-only mode exists in the component, but no Administrator route is added to the shell because the approved shell exposes only User Management to Administrators. Responsive screenshots belong to #40 and E2E to #39.
