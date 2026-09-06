# Issue #17 Requirements: Lab 2 Integration, E2E, Responsive, and Visual Evidence

Status: Implemented and locally verified; PR and peer-review evidence pending

## Goal

Prove that the approved Lab 2 Requester workflow works across the frontend, REST API, PostgreSQL, and attachment storage, while documenting responsive and visual evidence for the final review.

## In scope

- Add a Playwright configuration and a documented local E2E setup.
- Add an end-to-end test for selecting a Development Requester, creating a Ticket, finding it in My Tickets, opening Ticket Detail, and managing an attachment.
- Add E2E evidence for Requester A/B isolation and direct cross-requester access rejection.
- Add responsive browser assertions at desktop, tablet, and mobile viewports.
- Add keyboard and accessibility assertions for the primary Lab 2 flow.
- Add automated Zen Green style assertions for tokens, labels, read-only fields, validation, focus, badges, and responsive representations.
- Capture Playwright screenshots under the required `artifacts/lab-02/screenshots/` directories.
- Add the visual checklist and update `docs/lab-02/tests.md`, `README.md`, and `.gitignore` with final commands and evidence locations.

## Out of scope

- New ticket, requester, attachment, authentication, IT Staff, comments, notes, status, or administration features.
- Changes to the approved API, database model, ownership rules, attachment limits, or business behavior except integration defects required to satisfy the existing contract.
- Real authentication or claims that the Lab 2 requester header is a security boundary.

## Functional requirements

- FR-17-01 Playwright shall start the server and client against a documented disposable test setup, or clearly document the required pre-start commands when automatic startup is unavailable.
- FR-17-02 The E2E suite shall cover the complete happy path from requester selection through Ticket creation, official Ticket Number display, My Tickets, owned Ticket Detail, attachment upload, active download, soft removal, retained removed metadata, and blocked removed download.
- FR-17-03 The E2E suite shall demonstrate that switching from Requester A to Requester B clears A’s requester-specific data and that direct access to A’s Ticket and Attachment is rejected without data or bytes leakage.
- FR-17-04 Responsive tests shall run at 1440×900, 820×1180, and 390×844 and assert no page-level horizontal overflow, clipped primary controls, or inaccessible actions.
- FR-17-05 Desktop shall expose the Ticket table and mobile shall expose an equivalent Ticket card representation without duplicating or hiding required identifying data.
- FR-17-06 Keyboard tests shall verify reachable navigation, visible focus, labeled form controls, accessible validation, and operable attachment removal confirmation.
- FR-17-07 Style tests shall assert the approved Zen Green tokens and semantic hooks for editable, read-only, invalid, disabled, busy, success, warning, and error states.
- FR-17-08 Visual evidence shall include the required screen states and viewport dimensions, with paths recorded in the test plan.
- FR-17-09 The final integration audit shall run the server, client, and E2E suites from a clean documented setup with no required test skipped or disabled.

## Acceptance criteria

- AC-17-01 Given a clean seeded environment, when the E2E flow is executed, then one official Ticket is created and its number is found in My Tickets and Ticket Detail.
- AC-17-02 Given an active Ticket, when an allowed attachment is uploaded, downloaded, and soft-removed, then active bytes are available, removed metadata remains visible, and removed bytes are blocked.
- AC-17-03 Given Requester A’s Ticket, when Requester B is selected and A’s direct Ticket or Attachment URL is requested, then the response is a safe denial and no A data or file bytes are shown.
- AC-17-04 Given the approved desktop, tablet, and mobile viewports, when each Lab 2 screen is rendered, then there is no horizontal page overflow, clipping, overlap, or hidden required action.
- AC-17-05 Given a keyboard-only user, when the primary workflow is used, then controls have accessible names, focus remains visible, validation is announced, and the removal dialog can be completed or cancelled.
- AC-17-06 Given the UI specification, when style tests inspect the application, then required Zen Green tokens, control states, labels, badges, and responsive selectors are present.
- AC-17-07 Given all documented commands, when the full suite runs, then all required tests pass and `tests.md` records current results and traceability.

## Planned evidence

- `client/tests/lab-02/zen-green-style.test.tsx` covers the style and semantic contract.
- `e2e/lab-02/requester-ticket-flow.spec.ts` covers the complete workflow and cross-requester isolation.
- `e2e/lab-02/responsive.spec.ts` covers desktop, tablet, and mobile overflow and representation assertions.
- `e2e/lab-02/accessibility.spec.ts` covers keyboard and accessible-state assertions.
- `e2e/lab-02/visual-evidence.spec.ts` captures required loading, failure, empty, no-results, and filtered
  result states.
- `e2e/global-setup.ts` resets and seeds an isolated PostgreSQL schema and temporary Attachment storage.
- `artifacts/lab-02/screenshots/create-ticket/`, `my-tickets/`, and `ticket-detail/` contain named screenshots with viewport evidence.
- `docs/lab-02/tests.md` records commands, final status, and AC-to-test traceability.
- `README.md` documents setup, seed, server/client startup, unit/UI tests, and Playwright execution.
