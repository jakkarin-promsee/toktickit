# Issue #14 — My Tickets Requirements

## Goal

Allow the selected Development Requester to retrieve, find, and open only their
own Tickets through a responsive My Tickets screen.

## Functional requirements

- **FR-14-01 — Ownership:** `GET /api/tickets` requires an active
  `X-Requester-Id` context and returns only Tickets owned by that Requester.
- **FR-14-02 — Search:** `search` is trimmed, case-insensitive, and matches
  `ticketNumber` or `summary`.
- **FR-14-03 — Filters:** `categoryId`, `relatedSystemId`, `status`, and
  `requestedPriority` are supported. Multiple filters combine with AND.
- **FR-14-04 — Sorting:** `sortBy` supports `updatedAt`, `createdAt`,
  `ticketNumber`, and `summary`. `sortOrder` supports `asc` and `desc`.
  `id` is appended as a same-direction tie-breaker.
- **FR-14-05 — Pagination:** `page` starts at 1. `pageSize` accepts only 10,
  20, or 50. Defaults are page 1 and page size 10.
- **FR-14-06 — Query validation:** Missing, duplicate, malformed, unknown, or
  unsupported query values return `400 INVALID_QUERY`; values are not silently
  coerced.
- **FR-14-07 — Metadata:** Successful responses contain `data` and
  `pagination` with `page`, `pageSize`, `totalItems`, `totalPages`,
  `hasPreviousPage`, and `hasNextPage`.
- **FR-14-08 — Stable pages:** A page beyond the last page is valid and empty.
  When there are no matches, `totalPages` is 0.
- **FR-14-09 — Context isolation:** Switching Requesters clears the previous
  list state and loads the new Requester's list; A's Tickets must not appear
  for B.
- **FR-14-10 — UI states:** My Tickets exposes loading, first-use empty,
  filtered no-results, API failure, and successful-result states.
- **FR-14-11 — UI controls:** The screen provides search, all filters, sort
  controls, clear filters, page-size/page navigation, active-page indication,
  and a Create Ticket action.
- **FR-14-12 — Responsive representation:** Desktop uses a semantic table;
  mobile uses cards with equivalent identifying data and a visible View ticket
  action.

## API contract

### Request

```text
GET /api/tickets
X-Requester-Id: <positive active requester id>
```

Supported query parameters:

```text
search=<string, max 120>
categoryId=<positive integer>
relatedSystemId=<positive integer>
status=NEW
requestedPriority=LOW|MEDIUM|HIGH
sortBy=updatedAt|createdAt|ticketNumber|summary
sortOrder=asc|desc
page=<integer >= 1>
pageSize=10|20|50
```

### Response

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

Errors use the shared `{ "error": { "code", "message", "fields"? } }`
shape. Invalid requester context returns `400 INVALID_REQUESTER_CONTEXT`;
invalid query returns `400 INVALID_QUERY`; dependency failures return
`503 DEPENDENCY_UNAVAILABLE`; unexpected failures return `500 INTERNAL_ERROR`.

## Acceptance criteria

- **AC-14-01:** Requester A never receives Requester B's Tickets.
- **AC-14-02:** Search and every supported filter return only matching owned
  Tickets, including combined criteria.
- **AC-14-03:** Every supported sort is deterministic and uses the documented
  default when omitted.
- **AC-14-04:** Pagination returns the requested slice and consistent metadata,
  including an empty beyond-end page.
- **AC-14-05:** Invalid query parameters receive a safe `400` response.
- **AC-14-06:** The UI has distinct loading, empty, no-results, failure, and
  successful-result states.
- **AC-14-07:** Search/filter/sort/page-size changes reset to page 1 and Clear
  filters restores defaults.
- **AC-14-08:** Desktop and mobile representations expose equivalent ticket
  information without horizontal overflow.

## Test-first implementation checklist

- [x] Add pure query parsing tests for defaults, allowlists, duplicate values,
  trimming, and invalid values.
- [x] Add API tests for ownership, search, filters, sorting, pagination,
  metadata, invalid queries, and dependency-safe errors.
- [x] Add UI tests for controls, debounce/page reset, requester isolation, all
  major states, and responsive table/card semantics.
- [x] Implement the API and UI only after the tests fail for the expected
  missing-feature reason.
