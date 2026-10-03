# Issue #30 Requirements: Lab 3 Engineering Contract and Test Plan

Status: Implemented and verified locally on `feature/30-lab3-engineering-contract`; human peer review remains pending

## Goal

Create an internally consistent, reviewable, and testable Sprint 3 engineering contract before any Lab 3 production implementation begins, while preserving all completed Lab 2 behavior and resolving every implementation choice intentionally left open by the Lab 3 handout.

## In scope

- Create `docs/lab-03/specification.md` with the required eleven numbered sections, continuous Functional Requirement, Business Rule, and Acceptance Criterion IDs, an authorization matrix, a complete Ticket status-transition matrix, data and migration decisions, and a Product Definition of Done.
- Create `docs/lab-03/api-spec.md` with exact endpoint paths and methods, authentication and CSRF behavior, request and response shapes, validation, authorization, safe errors, and HTTP status codes for every required capability.
- Create `docs/lab-03/ui-spec.md` with the Zen Green application shell, role navigation, screen structure, modes, controls, feedback, responsive behavior, and accessibility rules for Login, Change Password, Requester Ticket Detail, Staff Ticket Queue, Staff Ticket Detail, and User Management.
- Create `docs/lab-03/tests.md` before feature implementation, covering unit, schema and migration, API and integration, UI component, UI style, responsive, security and authorization, regression, accessibility, visual, and end-to-end evidence.
- Add an automated documentation contract test that verifies required files and sections, continuous IDs, required endpoint coverage, authorization and workflow decisions, planned test categories, and complete Acceptance Criterion traceability.
- Define a reviewer checklist for conflicts, missing rules, unsafe authorization, inconsistent IDs, untestable criteria, and cross-document drift; actual peer-review identity, comments, replies, approval, PR metadata, and merge evidence remain future review records.

## Out of scope

- Production application code, runtime dependencies, Prisma schema changes, database migrations, authentication implementation, Ticket workflow implementation, UI implementation, screenshots, and runtime feature tests.
- Pull request details, GitHub comments, commits, merges, or fabricated peer-review evidence.
- Email invitations, password-reset email, email delivery of credentials, multi-factor authentication, social login, single sign-on, self-registration, Requester-created accounts, account unlocking, and Administrator approval workflows.
- Actions Taken, formal SLA calculations, escalation rules, notification services, dashboards or KPI analytics beyond simple queue counts, multi-tenant organizations, departments, customer administration, production deployment, and cloud infrastructure.
- Multiple roles per user, user deletion, bulk operations, import or export, role or account-history screens, profile photos, extended profiles, mandatory Administrator-list pagination, multi-column Administrator sorting, multiple simultaneous Administrator filters, and advanced identity management.

## Functional requirements

- FR-30-01 The four required contract files shall exist under `docs/lab-03/`, use English throughout, and avoid hard-wrapped prose so each paragraph and list item remains on one physical line.
- FR-30-02 The specification shall contain the eleven required numbered sections in the handout-defined order and use continuous unique `FR-01`, `BR-01`, and `AC-01` identifiers.
- FR-30-03 The contract shall define email/password authentication, current-user retrieval, logout, mandatory first-login password change, password rules, rate limiting, opaque server-side sessions, expiration, invalidation, secure cookie behavior, CSRF protection, and safe authentication failures.
- FR-30-04 The contract shall define backend-enforced authorization for Requester, IT Staff, and Administrator screens, APIs, and actions, and shall state that frontend visibility is not a security control.
- FR-30-05 The contract shall replace the Development Requester selector and `X-Requester-Id` identity with the authenticated user while preserving all Lab 2 Requester Ticket and Attachment behavior and ownership protections.
- FR-30-06 The contract shall define the IT Staff Ticket Queue searchable, filterable, sortable, paginated, ownership, field-set, feedback, and responsive behavior.
- FR-30-07 The contract shall define Staff Ticket Detail ownership controls, IT Priority, status transitions, Public Comments, Internal Notes, Attachment continuity, validations, confirmations, and safe failures.
- FR-30-08 The contract shall define Requester Public Comments and a Problem Appears Resolved signal that never directly sets a Ticket to Resolved or Closed.
- FR-30-09 The contract shall define a minimalist Administrator User Management workflow for listing, name/email search, optional role filtering, creation, basic editing, exactly one role, activation, deactivation, and new initial passwords, including self-deactivation and last-active-Administrator safeguards.
- FR-30-10 The contract shall define models, fields, types, enums, relationships, foreign keys, indexes, timestamps, activation and password-change state, a data-preserving migration, existing-user initial credentials, and an idempotent seed plan.
- FR-30-11 The API specification shall define every required endpoint's method, path, authentication and CSRF behavior, request and response shapes, validation, authorization, safe error behavior, and status codes.
- FR-30-12 The UI specification shall retain the Lab 2 Zen Green system and define reusable components, role-aware navigation, editable and read-only distinctions, all meaningful screen states, keyboard behavior, and desktop, tablet, and mobile layouts.
- FR-30-13 The Test DD matrix shall map every Acceptance Criterion to at least one planned automated test with a real target path and shall mark future implementation tests as Planned rather than claiming unexecuted passes.
- FR-30-14 The Product Definition of Done shall prevent a coding agent from reporting Sprint 3 complete until approved specifications, implementation, tests, migration, authorization evidence, responsive and accessibility checks, visual inspection, peer review, staged integration, and final-main evidence are complete.
- FR-30-15 The contract shall include at least one explicit traceability path from Functional Requirement through Business Rule and Acceptance Criterion to Test ID and target automated file.

## Acceptance criteria

- AC-30-01 Given the Issue #30 branch, when branch and worktree state are inspected, then the branch is `feature/30-lab3-engineering-contract` and pre-existing user changes are not overwritten.
- AC-30-02 Given the completed documentation change, when repository paths are inspected, then the four required contract files and the Issue #30 requirements baseline exist without production implementation or Prisma migration changes.
- AC-30-03 Given `specification.md`, when requirement IDs and headings are parsed, then all eleven required sections exist and FR, BR, and AC identifiers are unique and continuous.
- AC-30-04 Given the authorization matrix, when every protected capability is reviewed by role, then Requester ownership, IT Staff operations, Administrator account management, Administrator read-only Ticket visibility, and backend enforcement are unambiguous.
- AC-30-05 Given the status-transition matrix, when every required Ticket status is reviewed, then permitted sources, targets, roles, confirmations, and rejection behavior are explicit and Requesters cannot formally resolve or close Tickets.
- AC-30-06 Given the data and migration design, when it is compared with the Lab 2 Prisma schema, then existing User IDs, Ticket ownership, Attachment authorship and removal metadata, Categories, Related Systems, Ticket Numbers, and stored files remain valid.
- AC-30-07 Given `api-spec.md`, when the required capabilities are reviewed, then each exact endpoint includes auth/CSRF, payload, validation, success response, safe failures, and statuses, including queue query defaults and invalid-query behavior.
- AC-30-08 Given `ui-spec.md`, when required screens and states are reviewed, then Login, Change Password, application shell, Requester Detail, Staff Queue, Staff Detail, and User Management include role behavior, feedback, accessibility, and responsive contracts.
- AC-30-09 Given `tests.md`, when traceability is parsed, then every Sprint 3 AC maps to one or more planned tests and all handout-required test categories and Administrator cases have target paths.
- AC-30-10 Given the repository test command, when the documentation contract test runs, then it passes only when the four documents remain complete and internally aligned.
- AC-30-11 Given a peer review, when the provided checklist is used, then missing rules, ID gaps, authorization leaks, untestable criteria, unsafe errors, and cross-document conflicts can be identified before Issue #31 begins.
- AC-30-12 Given Git history and future PR metadata, when Issue #30 is reviewed, then no production code, runtime dependency, database migration, feature UI, PR narrative, comment, commit, merge, or fabricated approval is part of this implementation.

## Test-first implementation checklist

- [x] Record Issue #30 scope, Functional Requirements, Acceptance Criteria, exclusions, and intended evidence before creating the four contract deliverables.
- [x] Add `server/tests/lab-03/engineering-contract.test.ts` and run it to observe the expected missing-document failure.
- [x] Create `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md` only after the documentation test exists.
- [x] Run the focused documentation contract test and the complete server regression suite.
- [x] Inspect Markdown structure, identifier continuity, AC traceability, changed-file scope, and hard-wrap compliance.
- [x] Leave peer-review evidence, PR details, comments, commits, and merges for the user's later review workflow.
