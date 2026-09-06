# Lab 2 Sprint Engineering Specification

Status: Approved contract; Issues #10–#18 complete and released to `main`
Issue: #10
Branch: `feature/10-lab2-engineering-contract`

## 1. Sprint Goal

Deliver a professional, responsive Requester-facing ticket workflow in which a seeded Development
Requester can create and find owned tickets, inspect ticket details, and safely manage permitted
attachments. The sprint establishes reusable Zen Green UI conventions and a testable full-stack contract
without claiming to provide authentication.

## 2. Stakeholder Request

The IT department needs a usable Requester experience backed by PostgreSQL. A Requester selects a
temporary testing identity, submits a classified support request, receives a backend-generated official
number, and can later search and inspect only that identity's tickets. Attachments must be validated,
private, downloadable while active, and retained as metadata after soft removal.

## 3. Scope

### Included

- Development Requester selection, persistence, switching, and selected-identity display.
- Active Category and Related System reference data.
- Create Ticket, My Tickets, and Requester Ticket Detail.
- Requester-owned search, filtering, sorting, and pagination.
- Attachment upload during or after creation, metadata listing, download, and soft removal.
- Backend ownership checks, validation, safe errors, loading/empty/failure states, accessibility, and
  responsive Zen Green layouts.
- PostgreSQL/Prisma models, migration, idempotent seed, REST APIs, automated tests, and visual evidence.

### Excluded

- Real authentication, login/logout, passwords, password hashing, sessions, tokens, and security claims
  about the Development Requester selector.
- IT Staff workflows, assignment, IT Priority changes, queues, and Administrator management of users,
  Requesters, roles, or reference data.
- Public Comments, Internal Notes, Actions Taken, and collaboration features.
- Post-creation status transitions, resolution, closing, reopening, or cancellation.
- Hard deletion of Attachment records and general-purpose file management.

## 4. Functional Requirements

- FR-01 The app shall load only active Development Requesters and require one to be selected before
  requester-specific screens are used.
- FR-02 The app shall persist the selected Development Requester locally, show the current name, and
  provide Change Requester.
- FR-03 The app shall reload or clear requester-specific state whenever the selected Requester changes.
- FR-04 The app shall retrieve active Categories and Related Systems from PostgreSQL.
- FR-05 A selected Requester shall create a validated Ticket and receive its backend-generated Ticket
  Number.
- FR-06 Create Ticket shall display Ticket Number, Ticket Date, Requester, Category, Related System,
  Ticket Summary, Requested Priority, IT Priority, Current Status, Description, and an Attachments area.
- FR-07 Create Ticket shall prevent duplicate submission and retain entered values after recoverable
  failures.
- FR-08 A selected Requester shall retrieve only their Tickets using search, filters, deterministic sorting,
  and pagination.
- FR-09 My Tickets shall distinguish loading, first-use empty, filtered no-results, and safe failure states.
- FR-10 A selected Requester shall open an owned Ticket Detail with ticket fields presented read-only.
- FR-11 Direct access to a missing or differently owned Ticket shall not return ticket data.
- FR-12 A selected Requester shall upload permitted Attachments to an owned Ticket, up to the active limit.
- FR-13 The app shall list active and removed Attachment metadata for an owned Ticket.
- FR-14 A selected Requester shall download or preview an active owned Attachment.
- FR-15 A selected Requester shall soft-remove an active owned Attachment after confirmation and a valid
  reason.
- FR-16 Removed Attachments shall remain visible as metadata but shall not be previewable or
  downloadable.
- FR-17 All primary workflows shall provide accessible keyboard operation, visible focus, non-color-only
  feedback, and usable desktop, tablet, and mobile layouts.
- FR-18 The system shall emit safe, consistent API errors without exposing stack traces, storage paths, or
  another Requester's data.

## 5. Business Rules

- BR-01 The backend generates a unique official Ticket Number in `TKT-YYYYMMDD-NNNNNN` format; the
  database also enforces uniqueness.
- BR-02 A new Ticket has `currentStatus=NEW`; Requesters cannot change status in Lab 2.
- BR-03 The Development Requester selector is test context only and is not authentication or
  authorization.
- BR-04 Only active Requesters appear in the selector; an inactive, missing, or malformed selected ID is
  rejected.
- BR-05 The selected Requester ID is stored in `localStorage` under `toktickit.requesterId`; it is sent as
  `X-Requester-Id` to requester-scoped APIs and must be revalidated by the backend.
- BR-06 Changing Requester asks for confirmation when a form is dirty, then clears requester-scoped query
  caches, form drafts, and detail state before the new context loads.
- BR-07 Ticket Date, Ticket Number, Requester, Current Status, and IT Priority are backend-controlled and
  read-only; Ticket Date is the Ticket's `createdAt` timestamp and IT Priority initially displays
  `UNASSIGNED`.
- BR-08 Category, Related System, Ticket Summary, Requested Priority, and Description are required and
  editable.
- BR-09 Summary is trimmed, must be 5–120 Unicode characters, and internal whitespace is preserved.
- BR-10 Description is trimmed and must be 10–2,000 Unicode characters.
- BR-11 Requested Priority accepts only `LOW`, `MEDIUM`, or `HIGH`; it does not set IT Priority.
- BR-12 Category and Related System IDs must reference active records at submission time.
- BR-13 Frontend validation improves feedback, but identical backend validation remains authoritative.
- BR-14 While submission is pending, Submit is disabled and displays a busy label; repeated activation
  creates no second request from the UI.
- BR-15 A failed Ticket request retains editable values and selected local files; a successful request resets
  the form only after its result is shown. Clearing a dirty form requires confirmation.
- BR-16 Ticket ownership is immutable and comes from the validated `X-Requester-Id`, never a
  `requesterId` in the request body.
- BR-17 Missing and differently owned Tickets or Attachments return the same `404 RESOURCE_NOT_FOUND`
  response to avoid ownership disclosure.
- BR-18 Ticket search is case-insensitive over Ticket Number and Summary; filters combine with AND.
- BR-19 Supported filters are Category, Related System, Current Status, and Requested Priority.
- BR-20 Page numbers start at 1; allowed page sizes are 10, 20, and 50, with defaults `page=1` and
  `pageSize=10`.
- BR-21 Sortable fields are `updatedAt`, `createdAt`, `ticketNumber`, and `summary`; every sort appends
  internal `id` in the requested direction for stability. The default is `updatedAt desc, id desc`.
- BR-22 Empty means an owned Ticket count of zero without active criteria; no-results means active search
  or filters matched zero records.
- BR-23 Allowed Attachment types are JPG, JPEG, PNG, WEBP, and PDF, validated by extension, declared MIME
  type, and file signature where supported.
- BR-24 Each Attachment is at most 5 MB (5,242,880 bytes), and each Ticket may have at most five active
  attachments.
- BR-25 Files are stored outside the public web root using a generated UUID storage name; original name,
  detected MIME, byte size, checksum, uploader, and timestamps are metadata. Raw client paths are never
  used.
- BR-26 Each upload is staged and committed atomically with its metadata. On storage/database failure,
  temporary bytes are removed and no active Attachment record remains.
- BR-27 Create Ticket saves the Ticket first and uploads selected files one at a time. If a later upload
  fails, the Ticket and successful Attachments remain, the UI reports partial success, retains failed files,
  and offers retry; it never silently deletes the Ticket.
- BR-28 Soft removal requires confirmation and a trimmed reason of 10–250 characters, records
  `removedAt`, `removedByRequesterId`, and `removalReason`, and never hard-deletes metadata.
- BR-29 Removed files are excluded from the active count and return `410 ATTACHMENT_REMOVED` on an owned
  download request; duplicate removal returns `409 ATTACHMENT_ALREADY_REMOVED`.
- BR-30 Lab 3 must replace the client-supplied Development Requester header with an authenticated server
  identity while preserving Ticket ownership relationships and service-level ownership checks.

## 6. UI Specification Summary

The application uses the Zen Green shell and reusable controls defined in
[`ui-spec.md`](./ui-spec.md). It contains Requester Selection, Create Ticket, My Tickets, and Ticket Detail
screens. Labels sit above controls, required inputs show both an asterisk and field-level errors, read-only
fields are visually distinct, and busy/disabled/focus states are explicit. Desktop is multi-column at
992 px and above, tablet uses two columns where practical at 768–991 px, and mobile stacks below 768 px
without horizontal page scrolling.

## 7. Data Changes

### Models and key fields

- `RequesterUser`: integer `id`, unique `email`, `displayName`, `isActive`, `createdAt`, `updatedAt`.
- `Category`: existing integer `id` and unique `name`, plus `isActive`, timestamps, and Ticket relation.
- `RelatedSystem`: integer `id`, unique `name`, `isActive`, timestamps, and Ticket relation.
- `Ticket`: UUID `id`, unique `ticketNumber`, requester/category/system foreign keys, `summary`
  (`varchar(120)`), `description` (`varchar(2000)`), `requestedPriority`, `itPriority`, `currentStatus`,
  `createdAt`, `updatedAt`.
- `Attachment`: UUID `id`, Ticket foreign key, original and storage names, MIME, byte size, SHA-256,
  uploader foreign key, `createdAt`, nullable `removedAt`, `removedByRequesterId`, and `removalReason`.

Enums are `RequestedPriority(LOW, MEDIUM, HIGH)`, `ItPriority(UNASSIGNED, LOW, MEDIUM, HIGH)`, and
`TicketStatus(NEW)`. Lab 2 exposes no API that mutates IT Priority or status.

### Relationships, constraints, and indexes

One Requester owns many Tickets; one Ticket belongs to one Requester, Category, and Related System; one
Ticket has many Attachments. Foreign keys use restricted deletion. Indexes cover
`Ticket(requesterId, updatedAt, id)`, requester plus each filter field, `ticketNumber`, and
`Attachment(ticketId, removedAt)`. Email, reference names, storage names, and Ticket Number are unique.
Removal metadata is nullable only while active and is changed in one transaction.

**Decision rationale:** UUID internal Ticket IDs prevent clients from inferring creation volume, while the
separate human-readable Ticket Number supports service-desk communication. Database uniqueness is still
required because application-only collision checks are race-prone.

The idempotent seed upserts the required Categories **Account and Access**, **Hardware**, **Software**, and
**Network**; at least six Related Systems; at least four active Requesters; and at least one inactive
Requester by stable unique keys.

## 8. API Contract

The normative endpoint, payload, validation, pagination, status, and error definitions are in
[`api-spec.md`](./api-spec.md). Requester-scoped endpoints require `X-Requester-Id`; because this is not
authentication, backend ownership checks remain mandatory but are not a security boundary. Errors use a
stable `{ error: { code, message, fields? } }` shape.

## 9. Acceptance Criteria

- AC-01 Given active Requesters exist, when the selector loads, then only active Requesters are available
  and the page states that selection is not login.
- AC-02 Given no valid Requester is selected, when a requester-specific route opens, then the selector is
  shown and Continue stays disabled until a valid choice is made.
- AC-03 Given Requester A is active, when selected or changed to, then the shell shows A and stale data
  from the prior Requester is cleared; a dirty form requires confirmation before switching.
- AC-04 Given active reference data, when Create Ticket loads, then required editable and backend-controlled
  read-only fields are clearly distinguished.
- AC-05 Given valid Ticket input, when submitted once, then exactly one owned Ticket is saved with status
  NEW and a unique backend-generated Ticket Number is displayed.
- AC-06 Given invalid or boundary-breaking Ticket input, when submitted, then field errors appear and the
  backend also rejects equivalent invalid payloads without saving a Ticket.
- AC-07 Given a dirty, pending, or recoverable-failure form, when the user clears/submits it, then clearing
  requires confirmation, duplicate submission is blocked, and entered values remain available after
  failure.
- AC-08 Given owned Tickets, when search, filters, sort, and pagination are applied, then only matching owned
  Tickets appear in stable order with correct metadata.
- AC-09 Given no owned Tickets or no matches, when My Tickets loads, then distinct empty or no-results
  guidance appears; loading and API failure also have safe states.
- AC-10 Given an owned Ticket, when its detail URL opens, then all specified read-only data and Attachment
  metadata are shown.
- AC-11 Given a missing or differently owned Ticket, when detail is requested directly, then no Ticket data
  is returned and the response is the same safe 404.
- AC-12 Given a permitted file within 5 MB and fewer than five active Attachments, when uploaded to an
  owned Ticket, then safe metadata is saved and the active file can be downloaded.
- AC-13 Given an unsupported, oversized, sixth, corrupt, or differently owned upload, when attempted, then
  it is rejected safely without an active metadata/file orphan.
- AC-14 Given selected files during creation, when Ticket creation succeeds but one upload fails, then the
  Ticket and successful files remain, failed files are reported and retryable, and partial success is clear.
- AC-15 Given an active owned Attachment and valid removal reason, when removal is confirmed, then metadata
  is soft-removed and retained while the active count decreases.
- AC-16 Given a removed or differently owned Attachment, when download/removal is requested, then bytes are
  not returned and the defined safe removed/ownership response is used.
- AC-17 Given keyboard use and desktop, tablet, or mobile viewport, when any Lab 2 screen is used, then
  controls remain labeled, focus-visible, touch-usable, unclipped, and free of horizontal page overflow.
- AC-18 Given a documented clean setup, when all planned suites run, then every required automated test
  passes without skipped tests and visual evidence matches the approved UI contract.

## 10. Definition of Done

- [x] Issues #10–#17 implement all approved FR, BR, and AC without excluded functionality.
- [x] The four contract documents are internally consistent, peer-reviewed, and Issue #10 is merged before
      production implementation starts.
- [x] Prisma migration applies to a clean database; seed is repeatable and contains all required data.
- [x] Frontend and backend validation, ownership behavior, errors, and attachment boundaries match this
      contract.
- [x] Every AC maps to automated or explicit visual evidence in `tests.md`; no required test is skipped,
      disabled, commented out, flaky, or unrelated.
- [x] Unit, API/integration, UI component, style, responsive, and E2E suites pass using documented commands.
- [x] Desktop, tablet, and mobile screenshots and the visual checklist show no clipping, overlap, hidden
      actions, or horizontal overflow.
- [x] Setup, migration, seed, run, test, storage, and cleanup instructions are current in README.
- [x] A peer approves each feature PR into `lab2-staging`; review comments are resolved and recorded.
- [x] The release PR from `lab2-staging` to `main` passes final tests and contains required course evidence.

## 11. Assumptions and Decisions

- The Development Requester header is intentionally spoofable in Lab 2. It enables ownership-behavior
  testing but provides no security; demonstrations and documentation must say so.
- Server timestamps are UTC ISO 8601; the UI formats them in the browser locale.
- Ticket sequence generation may use a database-backed counter or retry-on-unique-conflict strategy, but
  it must remain concurrency-safe and preserve the specified format.
- Upload storage defaults to `server/storage/attachments`, outside static serving and ignored by Git.
- PDF opens in a new browser tab when supported; images may show an object-URL preview. Both use the owned
  download endpoint rather than a public filesystem URL.
- Search is submitted after a 300 ms debounce and resets to page 1; changing filters, sort, page size, or
  Requester also resets to page 1.
- Peer review may change these decisions before Issue #11 starts; any change must update all four contract
  documents and the contract test together.
