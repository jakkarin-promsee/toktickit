# Lab 4 Zen Green UI Specification

Status: Proposed Issue #57 screen contract. Extend the approved `../lab-03/ui-spec.md` design tokens, badges, cards, tables, form validation, shell, feedback, and responsive behavior. `specification.md` defines authorization and lifecycle rules; `api-spec.md` defines payloads and safe errors. All Action text is Requester-visible shared content and renders as escaped plain text.

## 1. Application shell and role navigation

The authenticated shell adds `Dashboard` as the first primary entry for each role and sets `aria-current="page"` on the active entry. Requester navigation is Dashboard, Create Ticket, My Tickets, and Logout. IT Staff navigation is Dashboard, Ticket Queue, and Logout. Administrator navigation is Dashboard, Ticket Review, Users, and Logout. The existing Change Password gate, skip link, mobile Menu button, Escape/focus return, current-user name/role, CSRF/session handling, and direct-route role guard remain. `/dashboard` renders the Requester or Staff/Admin dashboard for the authenticated role; direct protected routes use the backend gate as authority.

No existing Staff Ticket operation appears on Administrator Ticket Review, including claim, Owner, IT Priority, status, Public Comment composition, Internal Note composition, or Requester signal. Administrator Action Taken controls are deliberately available in the Action section under the Lab 4 matrix. A text callout explains `Ticket workflow is read-only for Administrators; Actions Taken may be managed here` so the mixed permissions are clear.

## 2. Requester Dashboard

Route `/dashboard` for Requester. One `h1` says `Dashboard`, followed by four compact cards labelled `Open Tickets`, `Waiting for You`, `Recently Updated`, and `Recently Resolved`, each with a numeric value and a text-labelled link that opens the exact My Tickets `view` filter from `api-spec.md`. The two lists are `Needs your attention` and `Recent Tickets`, at most five each; each row/card shows Ticket Number, Summary, text Status, and exact updated time and opens owned Ticket Detail. The dashboard does not expose another Requester's information, IT Priority, Internal Notes, or Action audit history.

The seven-day labels show the UTC date range represented by `windowStart`/`asOf`; dates may be localized for display, but the accessible time element includes exact UTC. Waiting for You is a current-state count, while Recently Updated/Resolved use the fixed returned window. A zero card still displays `0` and remains a working link to the matching empty view. Empty lists say `No Tickets need your attention` or `No Tickets updated in the last seven UTC days` and offer My Tickets. Loading uses named skeletons with no misleading old counts; safe failure shows a role-safe alert and Retry, and does not relabel stale data as current.

## 3. IT Staff and Administrator Dashboard

Route `/dashboard` for IT Staff or Administrator. Cards are `Unassigned Tickets`, `My Tickets`, and `My Active Actions`; each links to its exact Staff Queue `view`. Two compact distributions show `Tickets by Status` with all eight text-labelled buckets and `Tickets by IT Priority` with Low, Medium, High, including zero values; each bucket links to the corresponding Queue filter. Lists are `Recent Tickets`, `Urgent Tickets`, and `My Active Actions`, at most five rows each, with direct Ticket/Action links. Recent shows Ticket Number, Summary, Status, IT Priority, and updated time. Urgent shows the same plus a `High IT Priority` text cue. My Active Actions shows Action Description, Action status, Action Date/Time, Ticket Number, and a direct link to the Action in Ticket Detail.

`My` always means authenticated user ID, including Administrator. A Ticket with multiple assigned Actions may appear once in the My Active Actions Queue view with its matching Action count; the dashboard Action card counts Actions, and the UI explains this difference in the Queue result summary. No Account Management counts are introduced. An Administrator sees the same read dashboard data but Ticket links land in read-only Ticket Review with Action controls as permitted. Zero cards show `0`; each empty list has specific copy and a link to the Queue. Loading, forbidden, expired session, and safe failure use the shared Lab 3 states; a failed refresh cannot display an unmarked old count.

## 4. Actions Taken on Ticket Detail

Staff Ticket Detail `/staff/tickets/:ticketId` and Requester Detail `/tickets/:ticketId` add a section headed `Actions Taken` after the Ticket summary and before Public Comments/Internal Notes/Attachments. The Ticket Owner is identified in the Ticket summary as `Ticket Owner`; each Action card separately shows `Performed by` and `Assigned to`. These labels never collapse into one person. The list order is Action Date/Time ascending, then creation time and ID, and every item appears, including Planned, Completed, Cancelled, and another staff member's work. Empty state is `No actions recorded for this Ticket yet`; authorized writers get `Add action`, and Requesters get a read-only explanation.

Desktop uses a semantic table or stacked cards with Action Date/Time, Description excerpt, Status text badge, Performer, Assignee, Follow-Up cue, and `View`; expandable detail or a side panel shows full Result, Follow-Up Note, Attachment Notes, exact created/updated/completed/cancelled times, and Staff-only cancellation reason/audit link. Tablet may use cards where the table would clip. Mobile uses single-column cards with full-width action controls. Long descriptions, notes, Ticket Numbers, and names wrap safely. Status badges use color plus text; public Action content uses a shared-content label and Internal Notes keep their private label.

### Create mode

`Add action` opens a labelled modal/side panel with Action Date/Time (local date/time input converted to explicit-offset ISO UTC), Action Description, Result, Assigned to (active IT Staff/Administrator plus `Unassigned`), Follow-Up Required checkbox, conditional Follow-Up Note, and Attachment Notes. `Performed by` is read-only and shows the signed-in user; it is never an editable field. Help text distinguishes Action Date/Time from server-created time and says Attachment Notes refer to Ticket Attachments rather than uploading a file. A visible required marker and `aria-required` accompany Action Date/Time and Description; Follow-Up Note becomes visibly required and `aria-required` only when Follow-Up Required is checked. The submit button says `Add action` and sends Ticket version plus a stable per-draft idempotency key; repeated clicks are disabled while pending, and a recoverable retry reuses the same key and payload.

### View/edit, assignment, and lifecycle modes

Selecting an item opens `Action details` with shared fields and its status. Authorized content editors see `Edit action`, which prepopulates the complete editable set and saves with both Ticket/Action versions. `Assign` or `Reassign` is a separate control for nonterminal Actions, with an active-user select and confirmation when changing an existing assignee; inactive-assignee API rejection stays beside the select and preserves the draft. Status controls show only allowed targets from the Action matrix. `Start` requires an assignee; `Complete` requires an assignee, saved nonblank Result, and valid Follow-Up Note; `Cancel` opens a confirmation dialog with required reason. Planned can complete directly. Completed and Cancelled details are immutable and expose no edit/status controls. The UI indicates who completed/cancelled and when, and never rewrites Performed by.

An active IT Staff or Administrator sees only controls allowed by the actor rule: current assignee or Ticket Owner can edit/transition/complete/cancel; an authenticated creator can edit/cancel their own unassigned Planned Action; any active IT Staff/Administrator can assign/reassign a nonterminal Action. The backend remains authoritative if role/Owner/assignee changes while the panel is open. Requesters see every Action on their owned Ticket with only the shared fields, no creation/edit/assignment/status/audit controls. Administrator Action controls are present even though the surrounding Ticket workflow remains read-only.

### Action feedback and focus

Initial loading uses a named skeleton; an empty list has the correct role-specific action; per-form saving disables only the submitted controls; success announces the Action and refreshes list/detail/Ticket version without changing deterministic order. Validation errors appear beside fields, link via `aria-describedby`, and focus the first invalid field. `403` shows a role-safe message and removes stale controls; `404` shows the same safe missing/cross-owner experience; `409` preserves draft text/selection, focuses a conflict alert, and offers `Refresh action` without auto-resubmission; `422 INACTIVE_ASSIGNEE` names the assignee field without exposing account details beyond the already selected name. `500/503` shows safe Retry guidance and retains drafts. Closing a dirty panel requires discard confirmation. Modal initial focus is on heading/first field as appropriate, Tab stays inside, Escape closes if safe, and focus returns to its trigger.

## 5. Ticket workflow and history

The Staff status card lists only the current row's allowed Ticket targets and identifies blocked prerequisites in text: `Assign an active Ticket Owner first` or `Complete an action for this Ticket before resolving it`. The Resolved button remains available when the UI has enough data to guide the user, but the backend gate decides atomically. Resolved, Closed, Cancelled, and Reopened use the Lab 3 confirmation dialog naming source/target and send `confirmed: true` only after the user confirms; the backend rejects a required transition without the flag. Only IT Staff see these controls. The Requester's Problem Appears Resolved control remains on owned Waiting for Requester Tickets, announces that IT Staff must formally review/resolve, and does not update the displayed Ticket status by itself.

On successful transition, refresh Ticket summary, status badge, Action list where needed, version, and Staff workflow history. A blocked resolution maps `RESOLUTION_ACTION_REQUIRED` to the Action section with a direct `View Actions Taken` link; a stale Ticket or Action conflict preserves any draft, explains which resource changed, and offers Refresh without a silent retry. Staff/Administrator may expand `Workflow history` showing ordered baseline and later events with actor/time/type; a baseline is labelled `State observed during migration`, never presented as a real past transition. Requesters see the current status and their signal but not Staff event history.

## 6. Dashboard and filter navigation

Every dashboard card has a single accessible link whose URL exactly matches the API filters in `api-spec.md`. My Tickets and Staff Queue read the `view`, `from`, and `through` URL parameters, show an active filter summary, and preserve existing search/sort/pagination behavior where compatible. The seven-day cards carry the server's fixed UTC window into their destination so a count does not change meaning during navigation. Empty drill-down pages say which filter produced zero results and offer Clear filters. A direct Ticket/Action link verifies current role/ownership again and renders forbidden or safe not-found feedback without cached protected content.

## 7. Responsive, keyboard, accessibility, and visual checklist

| Width | Layout |
| --- | --- |
| Desktop `>=992px` | Centered max-width shell, multi-column metric cards, compact lists and semantic tables, Action panel beside Ticket context where space permits. |
| Tablet `768–991px` | Wrapping cards/navigation and readable two-column groups; switch Action table to cards before names or controls clip. |
| Mobile `<768px` | Collapsed Menu, one-column cards/forms, full-width primary actions, at least 44 px touch targets, no page-level horizontal scroll. |

Evidence viewports are 1440×900, 820×1180, and 390×844, plus a 200% zoom check. Each page has one `h1` and logical heading order. Inputs and icon controls have accessible names, status/priority have text cues, exact timestamps use semantic `<time>`, tables have headings/captions/scopes, focus uses the existing Zen Green 3 px outline with 2 px offset, and keyboard order follows visual order. Announcement regions report one result at a time without repeated chatter. Dialogs have accessible title/description, contained Tab order, Escape behavior, and focus return. At every width and zoom there are no clipped names, overlapping controls or validation, hidden actions, sticky focus occlusion, or horizontal page overflow.

### Visual and accessibility evidence checklist

- [x] Requester Dashboard: four labelled cards, attention/recent lists, owned-only data, zero/loading/error states, exact drill-down, desktop/tablet/mobile screenshots.
- [x] Staff Dashboard: three cards, all status/priority buckets, recent/urgent/current-user Action lists, zero/loading/forbidden/error states, exact links, desktop/tablet/mobile screenshots.
- [x] Administrator Dashboard and Ticket Review: Staff-style metrics, read-only existing Ticket workflow, Action-only controls, role navigation and active-page indication.
- [x] Actions Taken: ordered list, empty, create, view/edit, assignment/reassignment, start, direct complete, cancel, follow-up conditional requirement, inactive assignee, Requester read-only, terminal read-only, and differing Ticket Owner/Performer.
- [x] Ticket workflow: all eight status labels, allowed/denied controls, Owner/Action gate guidance, Requester advisory signal, confirmation, successful refresh, stale conflict, and append-only history baseline.
- [x] Keyboard and accessibility: skip link, menu, card links, Action panels/dialogs, first-invalid focus, error announcements, focus return, noncolor status cues, 200% zoom, 44 px touch targets.
- [x] Responsive and polish: 1440×900, 820×1180, 390×844 screenshots under `artifacts/lab-04/screenshots/`, no clipping/overlap/page overflow, no placeholder text, console errors, broken links, or duplicate/obsolete UI.

Execution evidence and screenshot links are recorded in `tests.md` and `artifacts/lab-04/README.md`; the checklist describes the tested local build and does not replace independent review.
