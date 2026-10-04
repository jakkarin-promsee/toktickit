# Issue #35 requirements — IT Staff Ticket Queue

Status: Implementation and automated test evidence are tracked on `feature/35-staff-ticket-queue`; PR target: `lab3-staging`; depends on #31 and #33.

## Functional requirements

- FR-35-01: `GET /api/staff/tickets` shall require a live session that has completed any password change and shall allow IT Staff and read-only Administrators, while Requesters receive `403 FORBIDDEN` and anonymous callers receive `401`.
- FR-35-02: The Queue shall return Tickets from every Requester with `id`, `ticketNumber`, `summary`, `requester`, `category`, `relatedSystem`, `requestedPriority`, `itPriority`, `currentStatus`, `owner` (or `null`), `requesterResolvedAt`, `createdAt`, `updatedAt`, and `version`, and shall never return descriptions, emails, or credentials.
- FR-35-03: `search` shall be trimmed, limited to 120 characters, and match case-insensitively on Ticket Number, Summary, Requester display name, and Requester email.
- FR-35-04: The Queue shall support exact filters `categoryId`, `relatedSystemId`, `status`, `requestedPriority`, `itPriority`, and `owner` (`me`, `unassigned`, or an active IT Staff or Administrator user ID), combined with AND.
- FR-35-05: Sorting shall allow only `updatedAt`, `createdAt`, `ticketNumber`, `requestedPriority`, `itPriority`, and `status`, default to `updatedAt desc`, and use `id` in the same direction as a deterministic tie-breaker.
- FR-35-06: Pagination shall be one-based with page sizes 10, 20, or 50 (default 20), return `page`, `pageSize`, `totalItems`, `totalPages`, `hasPreviousPage`, and `hasNextPage`, and treat beyond-end pages as valid empty results.
- FR-35-07: The response shall include global `counts` (`total`, `unassigned`, `mine`) that ignore the active search and filters.
- FR-35-08: Unknown, duplicate, malformed, unsupported, or inactive-reference query values shall return `400 INVALID_QUERY`.
- FR-35-09: The Staff UI shall provide a debounced (300 ms) search, Category, Related System, Status, Requested Priority, IT Priority, and Owner filters (All, My tickets, Unassigned), sort field and direction, page size, Clear filters, and pagination, with all state mirrored in the URL and restored on reload.
- FR-35-10: An invalid restored URL query shall reset to the documented defaults with a non-blocking message.
- FR-35-11: Desktop shall use a semantic table (Ticket, Summary with Requester, Requested and IT Priority badges, Status, Owner, Last updated, View) with sortable headers exposing `aria-sort`, and screens below 768 px shall use equivalent Ticket cards.
- FR-35-12: Unassigned Tickets shall show an `Unassigned` badge, and each row shall provide a View link to `/staff/tickets/:ticketId`, which in this issue is a read-only boundary page without mutation controls.
- FR-35-13: The UI shall show separate loading, updating, empty-database, no-results, forbidden, and safe-failure (with Retry that keeps filters) states.

## Test mapping

| Test ID | Automated evidence | Expected result |
| --- | --- | --- |
| UNIT-03 / API-07 | `server/tests/lab-03/staff-queue.api.test.ts` | Query parsing, authorization, shared results, counts, search fields, filters, owner modes, sorting, pagination, and `400` cases. |
| UI-05 | `client/tests/lab-03/StaffTicketQueue.test.tsx` | URL parsing and restore, debounce, filter and sort query building, paging, table and card data, ownership and badges, View link, and the loading, empty, no-results, forbidden, and failure states. |

## Scope boundary

This issue does not add claim or reassign, IT Priority or status mutation, comment or note creation, the Staff Ticket Detail operations, the `/api/staff/assignees` endpoint (so named-owner choices are not offered in the Owner filter), the Administrator read-only `Ticket Review` screen, or User Management. The Administrator may already call the Queue API, but no Administrator Queue route is added to the shell. Responsive screenshots belong to #40.
