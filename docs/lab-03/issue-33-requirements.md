# Issue #33 requirements — Role-based authorization and authenticated application shell

Status: Implementation and focused test evidence are tracked on `feature/33-role-authorization-shell`; PR target: `lab3-staging`.

## Functional requirements

- FR-33-01: Every existing Ticket and Attachment endpoint shall require a live authenticated session, and a password-change-required session may use only current-user, password-change, and logout capabilities.
- FR-33-02: Requester Ticket creation, listing, detail, and Attachment mutation shall require the Requester role and derive the User solely from the authenticated session, ignoring `requesterId` and `X-Requester-Id` values from the client.
- FR-33-03: A Requester shall receive the same safe `404 RESOURCE_NOT_FOUND` envelope for an absent Ticket or Attachment and one owned by another Requester.
- FR-33-04: Unsafe Requester Ticket and Attachment operations shall require the active session's allowed Origin and CSRF token before validation or mutation.
- FR-33-05: Requesters may not access Staff or Administrator route families, IT Staff may not access Administrator routes, and Administrators shall not receive IT Staff Ticket-operation permission implicitly.
- FR-33-06: The frontend shell shall show the authenticated name, role badge, Change password, Logout, and only the role's permitted destination; direct URLs and refreshes shall re-evaluate session, role, and password-change state.
- FR-33-07: Development Requester list/selector APIs, `X-Requester-Id` client transport, Change Requester controls, and persisted selected-requester state shall be removed.

## Test mapping

| Test ID | Automated evidence | Expected result |
| --- | --- | --- |
| SEC-02 | `server/tests/lab-03/authorization.api.test.ts` | Direct APIs enforce session, password-change, CSRF, role, ownership, forged-identity, and non-leakage rules. |
| UI-03 | `client/tests/lab-03/AppShell.test.tsx` | Navigation is role-specific, forbidden direct routes show safe feedback, and password-change state overrides normal routes. |

## Scope boundary

This issue establishes guards and the authenticated shell. Staff Queue data, Staff Ticket mutations, comments/notes behavior, and Administrator user CRUD remain the responsibility of their dedicated issues, while their route families already reject unauthorized callers at the boundary.
