# Issue #16 Requirements: Attachment Lifecycle

## Goal

Implement the complete requester-owned attachment lifecycle for Lab 2: upload permitted files, list safe metadata, download active files, and soft-remove files with a reason.

## In scope

- Upload one attachment to an owned Ticket through `POST /api/tickets/:ticketId/attachments`.
- List active and removed attachment metadata through `GET /api/tickets/:ticketId/attachments`.
- Download an active owned attachment through `GET /api/attachments/:attachmentId/download`.
- Soft-remove an active owned attachment through `DELETE /api/attachments/:attachmentId`.
- Add attachment upload controls to Create Ticket and Ticket Detail.
- Preserve a created Ticket when a later initial-file upload fails and report the failed files for retry.
- Add unit, API, and UI tests for validation, ownership, boundaries, state transitions, and safe failures.

## Functional requirements

- FR-16-01 The upload endpoint shall require a valid active Development Requester context and an owned Ticket.
- FR-16-02 The upload endpoint shall accept exactly one file part.
- FR-16-03 The server shall accept only JPG/JPEG, PNG, WEBP, and PDF files when extension, declared MIME type, and file signature agree.
- FR-16-04 The server shall reject files larger than 5,242,880 bytes and accept a file exactly at that limit.
- FR-16-05 The server shall allow no more than five active attachments per Ticket, including concurrent final-slot attempts.
- FR-16-06 The server shall generate a UUID storage name, store bytes outside the public web root, and never expose storage names, paths, or checksums.
- FR-16-07 A successful upload shall return safe metadata with state `ACTIVE`.
- FR-16-08 Metadata listing shall include active and removed records in the contract-defined order.
- FR-16-09 An active owned attachment shall be downloadable with safe content headers and filename handling.
- FR-16-10 A removed attachment shall never return file bytes and shall return `410 ATTACHMENT_REMOVED` to its owner.
- FR-16-11 Missing or differently owned Tickets and Attachments shall return the same safe `404 RESOURCE_NOT_FOUND` response.
- FR-16-12 Soft removal shall require a trimmed reason of 10–250 Unicode characters and retain the database metadata.
- FR-16-13 Repeating removal on an already removed owned attachment shall return `409 ATTACHMENT_ALREADY_REMOVED`.
- FR-16-14 The UI shall show uploading, invalid, active, removed, unavailable, and removal-confirmation states.
- FR-16-15 Create Ticket shall upload selected files after Ticket creation and shall report partial success without deleting the saved Ticket.

## Business rules

- BR-16-01 Attachment size is measured in bytes; the maximum is 5 MiB, equal to 5,242,880 bytes.
- BR-16-02 Active attachment count excludes soft-removed records.
- BR-16-03 Uploaded bytes are staged before the database record is committed; a failed upload leaves no active record or staged file.
- BR-16-04 Original filenames are retained only as display metadata after path components and control characters are removed.
- BR-16-05 Removal records `removedAt`, `removedByRequesterId`, and `removalReason`; the attachment row is never hard-deleted by the public API.
- BR-16-06 The Development Requester header is a Lab 2 testing context and is not authentication or a security boundary.

## Acceptance criteria

- AC-16-01 A valid owned file uploads successfully and appears in metadata with state `ACTIVE`.
- AC-16-02 An exact-5-MiB permitted file succeeds, while a 5-MiB-plus-one-byte file fails safely.
- AC-16-03 Unsupported, MIME-mismatched, signature-mismatched, missing, or multiple files fail without an orphaned record.
- AC-16-04 The sixth active upload is rejected, while a removed attachment does not consume an active slot.
- AC-16-05 An owner can list and download an active attachment, and response headers do not expose storage details.
- AC-16-06 A valid removal retains metadata, changes state to `REMOVED`, and decreases the active count.
- AC-16-07 A removed attachment cannot be downloaded or previewed, and repeated removal returns the contracted conflict.
- AC-16-08 Cross-requester access to Ticket or Attachment operations returns safe denial without metadata or bytes.
- AC-16-09 Create Ticket keeps the saved Ticket and reports retryable failed files when a later upload fails.
- AC-16-10 The UI provides accessible controls and clear active, uploading, invalid, removed, and confirmation states.

## Planned evidence

- `server/tests/lab-02/attachment-validation.test.ts` covers file signatures, supported types, size boundary, safe names, and removal reasons.
- `server/tests/lab-02/attachments.api.test.ts` covers upload, metadata, download, soft removal, ownership, invalid files, and the active-count boundary.
- `client/tests/lab-02/RequesterTicketDetail.test.tsx` covers active controls, removal validation, and removed-file unavailable state.
- `client/tests/lab-02/CreateTicket.test.tsx` covers attachment selection and partial-success behavior.
