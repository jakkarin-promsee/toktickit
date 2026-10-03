# Lab 3 UI Specification

Status: Proposed visual and interaction contract for peer review under Issue #30

This document extends the approved Lab 2 Zen Green design and is normative for authentication, role-aware navigation, Requester regression, Staff Ticket Queue/Detail, read-only Administrator Ticket review, and minimalist User Management.

## 1. Design system continuation

The Lab 2 tokens remain authoritative: `--green-700 #006B3C`, `--green-600 #0B7A46`, `--green-050 #EAF6EF`, `--page #F5F7F6`, `--surface #FFFFFF`, `--text #17352A`, `--muted #5C6F67`, `--border #C8D5CF`, `--readonly #F1F3EE`, `--danger #9B1C1C`, and `--warning #9A6700`. Lab 3 adds `--note #FFF8E1` and `--note-border #C58A00` for Internal Notes; this treatment always includes the visible text `Internal Note` and never relies on color alone.

Use the existing system sans-serif stack, 16 px body size, 1.5 line height, 4/8/12/16/24/32/48 px spacing scale, centered 1200 px maximum content width, 1 px card borders, 8 px radius, and restrained shadows. New screens shall reuse existing Button, Field, Select, Card, Badge, Callout, Dialog, Skeleton, Table, Pagination, Attachment, and EmptyState patterns rather than creating parallel styles.

### Badge vocabulary

| Type | Visible values | Non-color requirement |
| --- | --- | --- |
| Role | Requester, IT Staff, Administrator | Full role text is always present. |
| Status | New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled | Full status text is always present. |
| Requested Priority | Low, Medium, High | Prefix or adjacent label identifies Requested Priority. |
| IT Priority | Low, Medium, High | Prefix or adjacent label identifies IT Priority. |
| Account | Active, Inactive, Password change required | Full state text is always present. |
| Ownership | Unassigned or owner display name | Text appears independently of icon/color. |

Status badge colors use restrained semantic tints: New/neutral, Open/blue, In Progress/green, Waiting/amber, Resolved/teal, Closed/gray, Reopened/purple, and Cancelled/red. Requested and IT Priority use the same Low/Medium/High palette but remain separately labeled to prevent confusion.

## 2. Application shell and route protection

The header shows `TokTickIT`, permitted navigation, the authenticated display name, a full-text role badge, Change password, and Logout. The active route uses visible styling plus `aria-current="page"`. Desktop navigation is inline; below 768 px it collapses behind a text-labeled Menu button with `aria-expanded`, while identity, role, password, and Logout remain keyboard reachable.

| Role | Navigation |
| --- | --- |
| Requester | My Tickets, Create Ticket |
| IT Staff | Ticket Queue |
| Administrator | Users, Ticket Review (read-only) |

An unauthenticated route renders Login without the application navigation. A session with `mustChangePassword=true` renders only Change Password and Logout and redirects attempts at normal routes back to Change Password with an explanatory callout. A role-mismatched client route renders a Forbidden page with a link to that role's home; this UI is supplemental to backend `403` enforcement.

Initial app loading displays `Checking your session…` in a labeled shell skeleton. `401` clears in-memory User/CSRF state and routes to Login with `Your session ended. Sign in again.` A `403 PASSWORD_CHANGE_REQUIRED` routes to Change Password. `403 FORBIDDEN` keeps the session and renders Forbidden. Safe unexpected failures retain the current route, show a generic alert, and offer Retry where the request is idempotent.

Logout disables itself, shows `Signing out…`, calls the API once, clears local User/CSRF/query/form state only after `204`, and routes to Login. If logout fails or the server is unavailable, the client remains in the authenticated shell, displays `We could not sign you out. Try again.`, and offers Retry because it cannot honestly claim that the HttpOnly server session was revoked.

## 3. Reusable interaction rules

### Fields and validation

- Labels sit above controls; required labels show a visible `*`, screen-reader `(required)` text, and HTML `required` or `aria-required`.
- Text/password/select controls are at least 44 px high; multi-line Comment/Note/Description controls are at least 120 px high and vertically resizable.
- Editable controls use a white surface; read-only values use `--readonly`, cannot accept input, and are represented as definition-list text rather than disabled inputs when no form behavior is needed.
- Invalid controls set `aria-invalid="true"` and `aria-describedby` to the adjacent field error; a summary may supplement but never replace field-level errors.
- Client validation mirrors server boundaries for fast feedback, but server validation is authoritative and returned `fields` errors map to their controls.
- Submission validation focuses the first invalid field; server conflict alerts receive programmatic focus without discarding entered values.

### Buttons, busy state, and confirmation

- Primary actions use solid green, secondary actions use white with green border, tertiary actions use text/link treatment, and destructive or high-impact transitions use danger styling.
- Busy buttons preserve width, display action-specific text such as `Signing in…` or `Saving user…`, set `aria-busy`, disable repeated activation, and do not disable unrelated reading/navigation unless consistency requires it.
- Reassignment, Problem Appears Resolved, Resolved, Closed, Cancelled, Reopened, account deactivation, role change, and initial-password reset use an accessible confirmation dialog naming the subject and consequence.
- Dialogs have labeled title/description, trap focus, put initial focus on Cancel unless the action is harmless, close on Escape, and restore trigger focus.
- Success uses `role="status"`; validation and failure use `role="alert"`; dynamic loading names the resource being loaded.

### Safe text and disclosure

Public Comments and Internal Notes render as escaped plain text with preserved line breaks and wrapping; HTML-like text is displayed literally. Internal Notes use the amber note surface, a lock icon with accessible name, and repeated `Visible only to IT Staff and Administrators` text. Public Comment composition never shares a tab, field, submit button, or draft with Internal Note composition.

Ticket not-found and Requester unauthorized ownership use the same `Ticket not found` screen and do not reveal whether another User owns the Ticket. Internal Note `403` shows `You do not have access to internal notes` without counts, previews, author names, or Ticket-existence hints.

## 4. Login

Route: `/login`. A centered Zen Green card contains the TokTickIT product name, `Sign in` heading, short guidance, labeled Email and Password fields, Show password toggle with accessible pressed state, and primary Sign in button. No self-registration, invitation, forgot-password link, social login, or role selector appears.

Client validation requires a syntactically valid email no longer than 254 characters and a non-empty password no longer than 128 characters. It does not reveal whether an account exists or pre-validate login password composition.

States:

- Initial: empty fields, no error, Sign in enabled only when required values exist.
- Validation: first invalid field focused with adjacent messages.
- Submitting: inputs and button disabled, button says `Signing in…`, one API request is active.
- Authentication failure: one alert says `Sign-in failed. Check your credentials or account status.` and password is cleared while email remains.
- Rate limited: alert says `Too many sign-in attempts. Try again in X minutes.` using `Retry-After`; password is cleared.
- Safe failure: alert says `We could not sign you in right now. Try again.`; email remains and password is cleared.
- Success with initial password: route replaces Login with Change Password without briefly rendering a normal role home.
- Success with regular password: route goes to My Tickets for Requester, Ticket Queue for IT Staff, or Users for Administrator.

## 5. Mandatory and voluntary Change Password

Route: `/change-password`. Mandatory mode replaces the normal shell content and shows `Change your initial password before continuing`; voluntary mode opens from the authenticated shell and includes normal role navigation.

The card contains Current password, New password, Confirm new password, a visible rules list, Show password controls, Change password, and Logout. New Password rules state 12–128 characters with lowercase, uppercase, digit, symbol, and a value different from Current password. Confirm must match locally and is never sent to the API.

States:

- Initial: rules are visible before interaction and Submit is available once fields are non-empty.
- Validation: rule checklist and adjacent field errors update without announcing every keystroke; submit focuses the first invalid field.
- Submitting: fields disabled and button says `Changing password…`.
- Current-password or policy failure: safe field errors appear and password values remain only long enough to correct; navigation remains blocked in mandatory mode.
- Success: password fields clear, a status says `Password changed`, rotated User/CSRF state replaces the prior session, and mandatory mode routes to the role home.
- Safe failure: values remain for retry except the current password may be cleared after an ambiguous credential response; normal routes remain blocked in mandatory mode.

## 6. Requester regression and Ticket Detail extension

Create Ticket and My Tickets retain the Lab 2 layout, validation, search/filter/sort/pagination, loading/empty/no-results/failure, Attachment, and responsive behavior. The Development Requester selector, Change Requester action, `toktickit.requesterId` state, and all testing-identity guidance are removed. Requester name/role comes from the authenticated shell, and direct API or route requests never accept a selectable identity.

Requester Ticket Detail retains the read-only Ticket information and Attachment cards and adds a `Public Comments` section below Ticket information. Each Comment displays author, browser-local formatted time with exact accessible timestamp, and safely wrapped plain text. A composition field shows `Add public comment`, `0/2000` counter, audience text `Visible to you and support staff`, and a `Post comment` button.

When status is Waiting for Requester and no current signal exists, a separate action card shows `Problem appears resolved`, explains `This tells support that the issue seems fixed; support must still resolve or close the Ticket`, and requires confirmation. After success it shows the recorded date and removes the action. The action is absent in other statuses, but direct invalid requests still rely on backend rejection.

Requester detail states include loading skeleton, owned result, Comment posting busy/success/validation/failure, Problem Appears Resolved confirmation/busy/success/conflict, safe not found, Attachment states inherited from Lab 2, and whole-detail safe failure with Retry. Requesters never see Internal Note markup, count, tab, input hint, API response, ownership controls, IT Priority controls, or formal status controls.

## 7. IT Staff Ticket Queue and Administrator Ticket Review

Route: `/staff/tickets`. IT Staff sees heading `Ticket Queue`; Administrator sees `Ticket Review` plus a persistent `Read-only administrator view` callout and no mutation affordance. Both use the same query contract and readable result layouts.

### Controls

- Search field labeled `Search tickets` with help `Ticket number, summary, requester name, or email`, 300 ms debounce, and maximum 120 characters.
- Filters for Category, Related System, Status, Requested Priority, IT Priority, and Owner; Owner values include All owners, My tickets, Unassigned, and eligible named owners where the role permits the endpoint.
- Sort field and direction, page-size selector 10/20/50, Clear filters, and pagination; search/filter/sort/page/page-size are reflected in the URL and restore after reload/direct navigation.
- Three summary cards show Total tickets, Unassigned, and Mine; they remain global counts and do not change with current filters.

### Desktop field set

The desktop semantic table uses Ticket Number; Summary with Requester beneath it; Requested and IT Priority as separately labeled badges; Status; Owner; Last Updated; and View. Category/Related System remain filters and appear in detail rather than table columns, which avoids an unreadable mega-grid while retaining the fields needed to identify, prioritize, and open work. Sort buttons use `aria-sort`; View is an independent accessible link rather than a click-only row.

### Tablet and mobile

At 768–991 px the table remains when it fits within the content width, with Summary wrapping and filter controls in two columns; no page-level horizontal scroll is permitted. Below 768 px each result becomes a Ticket card with Ticket Number, Summary, Requester, both labeled priorities, Status, Owner, Last Updated, and View in the same reading order. Controls stack, Clear remains adjacent to filters, and pagination wraps.

### States

- Loading: controls remain usable but results/counts use named skeletons; stale data is visually marked and cannot be mistaken for updated results.
- Empty: no Tickets exist; IT Staff sees operational guidance and Administrator sees read-only guidance.
- No results: active criteria summary, `No tickets match`, and Clear filters.
- Results: stable ordered rows/cards with exact pagination summary `Showing X–Y of Z`.
- Invalid restored URL query: reset to documented defaults and show a non-blocking message; the API still rejects invalid direct queries.
- Forbidden: role-safe Forbidden page without loading Ticket data.
- Failure: current criteria remain, safe alert and Retry appear, and no stale response is relabeled current.

## 8. Staff Ticket Detail and read-only Administrator mode

Route: `/staff/tickets/:ticketId`. The page begins with back link, Ticket Number heading, Status/Requested Priority/IT Priority/Owner badges, updated time, and version-conflict refresh guidance. Cards group Requester and classification, issue Summary/Description, workflow metadata, and Attachments.

### IT Staff operational controls

- Ownership card shows current owner, Claim when unassigned, and Assign/Reassign select populated with active IT Staff/Administrator Users. Replacing an owner requires confirmation; the current version is sent with mutations.
- Priority card shows immutable Requested Priority beside editable IT Priority. Saving disables only the priority form and announces success.
- Status card lists only allowed next transitions computed from the current status. Owner-required transitions remain disabled with text `Assign an owner first`. Resolved, Closed, Cancelled, and Reopened require a confirmation dialog naming source and target.
- A stale-version conflict preserves drafts, displays `This Ticket changed. Refresh before trying again.`, and offers Refresh; the UI never silently retries a mutation against a new version.

### Communication and Attachments

Three clearly separated sections or tabs are `Public Comments`, `Internal Notes`, and `Attachments`. Public Comments use the public surface and audience label; Internal Notes use the amber locked surface and restricted audience label; switching sections preserves at most one in-memory draft per section until submit/navigation confirmation. Actions Taken or Service Actions never appear.

IT Staff may compose both Public Comments and Internal Notes through independent fields/buttons and may read/download Attachments without upload/remove controls. Administrator read-only mode can read Comments, Notes, and Attachments but renders no composition, claim, assignment, priority, status, upload, removal, or Problem Appears Resolved controls.

### States

Detail defines loading, ready, per-card saving, comment/note posting, validation, success, confirmation, stale conflict, not found, forbidden, Attachment unavailable, and safe failure. A failed field mutation preserves its selected value; a failed Comment/Note preserves its draft. A whole-detail Retry does not re-submit mutations.

Desktop uses a two-column top region with workflow controls beside read-only data and full-width communication/Attachment sections. Tablet uses two columns only where labels remain readable. Mobile stacks cards and keeps the primary action within the relevant card; no sticky control may cover content or keyboard focus.

## 9. Administrator User Management

Route: `/admin/users`. This is the only account-management screen. Header actions contain `Create user`; controls contain search by name/email, optional single Role filter, and Clear. The default order is display name then ID; no pagination, user deletion, bulk action, import/export, multi-column sorting, multiple simultaneous filters, departments, history, or recovery workflow appears.

### User list

Desktop uses a semantic table with Name, Email, Role, Status, and Edit. Status may include Active/Inactive and Password change required as text badges. Mobile uses cards containing the same fields and one Edit button. Empty means no Users exist and offers Create user; No results summarizes active criteria and offers Clear.

### Create and edit panel

Create opens a modal or side panel titled `Create user` with Display name, Email, Role, Active checkbox, Initial password, Confirm initial password, visible password rules, Create user, and Cancel. Edit uses `Edit user` with Display name, Email, Role, Active checkbox, read-only password-change state, Save changes, `Set new initial password`, and Cancel.

Create validation uses 2–100 trimmed display-name characters, valid email up to 254 characters, exactly one role, Boolean Active, 12–128 password composition, and matching confirmation. Duplicate email maps to the Email field without revealing credential state.

Editing the signed-in Administrator disables their own Role and Active controls with explanations. A potentially last active Administrator may show warning text, but backend conflict remains authoritative. A User who owns Tickets shows `Reassign owned Tickets before deactivation or changing this User to Requester`; backend `USER_OWNS_TICKETS` maps to a conflict alert with a Ticket Review link.

Role change or deactivation requires confirmation naming the User and noting session revocation. Initial-password reset opens a separate dialog with new/confirm fields, rules, and warning `All current sessions for this User will end, and they must change this password at next login`; the success response never displays or copies the password.

### States

- List loading, empty, no-results, results, forbidden, and safe failure with Retry.
- Panel create/edit loading, initial, dirty, validation, saving, success, duplicate email, stale version, self-protection, last-active-Administrator, owner conflict, and safe failure.
- Closing a dirty panel or switching selected User requires discard confirmation; successful save closes or resets the panel only after the refreshed row is available and a page-level status names the User.
- A stale User conflict preserves fields and offers Reload; no automatic overwrite occurs.

## 10. Feedback and failure mapping

| API result | UI behavior |
| --- | --- |
| `400` malformed/invalid query | Field/query guidance when actionable; otherwise safe alert and reset only user-visible invalid URL criteria. |
| `401` | Clear current User/CSRF/query-sensitive state, route to Login, and announce session end. |
| `403 PASSWORD_CHANGE_REQUIRED` | Route to mandatory Change Password and explain why. |
| `403 CSRF_INVALID` | Keep non-secret form input, refresh session through `/auth/me`, and ask the User to submit again; never auto-repeat the mutation. |
| `403 FORBIDDEN` | Render role-safe Forbidden; never show cached protected payload from a prior User. |
| `404` | Show the same safe not-found experience for missing and cross-owner Requester resources. |
| `409` | Preserve input, focus a conflict alert, explain refresh/reassignment/safety action, and never silently overwrite. |
| `410` | Mark visible removed Attachment metadata and remove Download/Open. |
| `413/415/422` | Attach adjacent field/file errors and keep valid inputs/drafts. |
| `429` | Display retry time, clear password, and prevent submission until the visible countdown expires. |
| `500/503` | Generic safe alert, retain recoverable input, and offer Retry only when it cannot duplicate an unsafe mutation. |

## 11. Responsive and accessibility contract

| Viewport | Required layout |
| --- | --- |
| Desktop `>=992px` | Centered max-width content, inline shell navigation, multi-column forms/cards, semantic Queue/User tables. |
| Tablet `768–991px` | Wrapping navigation/filters, two columns where readable, table or cards without page overflow. |
| Mobile `<768px` | Collapsed menu, single-column forms/cards, Ticket/User cards, full-width primary actions, touch targets at least 44 px. |

Required evidence viewports are 1440×900 desktop, 820×1180 tablet, and 390×844 mobile. At all widths and at 200% zoom there shall be no page-level horizontal scrolling, clipped labels, overlapping validation, hidden actions, unreadable names/content, or controls covered by sticky elements. Long emails, Ticket Numbers, Comments, Notes, and filenames wrap safely.

Every page has one `h1` and logical heading order. Fields and controls have accessible names; tables use captions or nearby headings, header scopes, and sortable semantics; badges include text; icon-only controls have accessible labels; focus uses the existing 3 px green outline with 2 px offset. Live regions avoid repeated chatter, focus moves only for route heading, validation, dialog, or high-priority conflict/error, and keyboard order follows visual order.

## 12. Visual evidence checklist

- [ ] Login initial, validation, busy, generic authentication failure, rate limit, safe failure, and success routing match Zen Green.
- [ ] Mandatory Change Password rules, validation, busy, failure, success, and blocked-navigation behavior are clear.
- [ ] The shell shows correct name/role/navigation/Logout for Requester, IT Staff, and Administrator at all widths.
- [ ] Requester Ticket Detail shows Public Comments and conditional Problem Appears Resolved without Internal Notes or formal workflow controls.
- [ ] Staff Queue shows results, filters, sort, pagination, counts, assigned/unassigned ownership, empty, no-results, forbidden, failure, and equivalent mobile cards.
- [ ] Staff Detail clearly separates read-only data, editable workflow cards, Public Comments, Internal Notes, and Attachments and includes confirmation/conflict states.
- [ ] Administrator Ticket Review is visibly read-only and exposes no mutation or composition controls.
- [ ] User Management shows list/cards, search/role filter, create/edit/reset panels, validation, success, duplicate, self-protection, last-admin, owner, stale, forbidden, and failure states.
- [ ] Role, status, Requested Priority, IT Priority, account, and ownership badges use consistent text and do not depend on color.
- [ ] Desktop, tablet, mobile, keyboard, focus, 200% zoom, clipping, overlap, and horizontal-overflow checks pass for every major screen.

Screenshots belong under `artifacts/lab-03/screenshots/authentication/`, `staff-queue/`, `staff-ticket-detail/`, and `user-management/`; Requester regression evidence may use `artifacts/lab-03/screenshots/requester/` in addition to the handout minimum.
