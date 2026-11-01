# Lab 4 Manual UAT Script

Status: Ready for a human tester to execute; no manual result is claimed by this document.

This script tests the delivered Labs 1–4 product from its first screen through the three roles, Action Taken lifecycle, Ticket workflow, dashboards, regression behavior, responsive layout, accessibility, and controlled technical checks. The expected results follow `specification.md`, `ui-spec.md`, `api-spec.md`, and the current application labels. Record actual results and defects rather than marking a case Pass from the automated test report.

## 0. Prepare a safe, repeatable UAT run

1. Install dependencies if this checkout is new with `npm install`, `npm --prefix server install`, and `npm --prefix client install`; install Chromium with `npx playwright install chromium` only if you will run the automated browser gate in UAT-50.
2. Copy `server/.env.example` and `client/.env.example` to their `.env` paths if missing, set the documented local URLs, and point `DATABASE_URL` at a disposable UAT database or schema; verify the resolved database and schema before any migration or seed, and do not reset `public` or data that must be kept.
3. Start PostgreSQL; from `server/`, run `npx prisma generate`, `npx prisma migrate status`, `npx prisma migrate deploy`, and `npx prisma db seed` against that disposable UAT target, or verify the same migrations/seed if an existing UAT environment is already prepared. Run no Playwright or Vitest database reset against the UAT schema while following this script.
4. From the repository root, start the API with `npm --prefix server run dev` and the client with `npm --prefix client run dev` in separate terminals. Open the client URL shown by Vite, normally `http://localhost:5173`, in a fresh browser profile and keep the API URL shown by the server, normally `http://localhost:3000`, for Section 9.
5. Check `server/.env` privately for `LAB3_SEED_INITIAL_PASSWORD`; never copy the actual value into this document, a screenshot, a defect report, or a commit. A seeded account that has already changed its password needs its current local password instead; rerunning seed does not reset it.
6. Choose a unique `RUN_ID`, such as `20261101-A`, and replace `<RUN_ID>` in every test value below. Use Browser A for the current actor and a separate profile or private window for Browser B so their cookies and sessions never mix.
7. Whenever a step says to sign in as a different account in the same profile, click Logout first; keep both sessions open only when a case explicitly calls for two browsers.
8. Record the initial Requester and Staff dashboard values before creating UAT records; the seven-day cards depend on current UTC time, so do not assume that October seed Tickets still count as recent on the day you test.
9. Save only synthetic screenshots with the Ticket number or UAT ID in the filename, initially under ignored `plan/uat-evidence/<RUN_ID>/`; copy only reviewed, sanitized images into tracked artifacts later if needed. Do not capture passwords, session cookies, CSRF tokens, `.env`, database dumps, or private storage paths.

### Seeded account roster

| Sign-in email | Role | Initial state | Purpose |
| --- | --- | --- | --- |
| `anan@example.test` | Requester | Active | Creates the four UAT Tickets and checks owned data. |
| `mali@example.test` | Requester | Active | Checks a different owner's isolation and the seeded Wi-Fi Ticket. |
| `pim@example.test` | Requester | Active | Checks the seeded Waiting for Requester state. |
| `narin.staff@example.test` | IT Staff | Active | Primary Staff actor and Ticket Owner. |
| `kanda.staff@example.test` | IT Staff | Active | Separate assignee and concurrent editor. |
| `thep.staff@example.test` | IT Staff | Active | Third eligible assignee. |
| `araya.admin@example.test` | Administrator | Active | User Management and Administrator Action permissions. |
| `somchai.inactive@example.test` | Requester | Inactive | Safe sign-in denial. |
| `wichai.inactive.staff@example.test` | IT Staff | Inactive | Assignee-choice exclusion. |

### Data register to fill during execution

| Key | Create as | Summary or email | Record actual ID/number |
| --- | --- | --- | --- |
| `T_MAIN` | Anan | `UAT <RUN_ID> classroom Wi-Fi incident` | `________________` |
| `T_ACTION` | Anan | `UAT <RUN_ID> action lifecycle` | `________________` |
| `T_STALE` | Anan | `UAT <RUN_ID> concurrent Ticket edit` | `________________` |
| `T_CANCEL` | Anan | `UAT <RUN_ID> cancelled Ticket branch` | `________________` |
| `U_STAFF` | Araya | `uat.staff.<RUN_ID>@example.test` with punctuation removed from the email prefix if needed | `________________` |
| `U_EMPTY` | Araya | `uat.empty.<RUN_ID>@example.test` with punctuation removed from the email prefix if needed | `________________` |

Use a new private UAT password for `U_STAFF` and `U_EMPTY`; the example password shape `ManualUat!2026A` satisfies the policy, but choose and record your own value privately. The seed Tickets `TKT-20261004-310002` (Mali, Open, two Actions), `TKT-20261004-310004` (Pim, Waiting for Requester), and `TKT-20261004-310005` (Anan, Resolved) are useful read-only references; avoid changing them so later comparisons remain clear.

For each UAT ID, record `Pass`, `Fail`, or `Blocked`, the date/time, browser and viewport, actual result, screenshot path, and defect ID in the execution log at the end. A case passes only if every expected result is observed.

## 1. First screen, authentication, and role shell

### UAT-01 — First page and health [AC-18, AC-19]

1. In a browser with no TokTickIT session, open the client root URL.
2. Wait for the `Sign in` card and check that it has `Email`, `Password`, `Show password`, and `Sign in`, with no protected Ticket or dashboard data.
3. In another tab, open the API `/api/health` URL.

Expected: The client shows the Zen Green sign-in page, and health returns HTTP 200 with exactly `{ "status": "ok", "service": "TokTickIT API" }`.

### UAT-02 — Sign-in field validation and password visibility [AC-18, AC-19]

1. Click `Sign in` with both fields empty; check that focus moves to Email and both required messages appear.
2. Enter `not-an-email` and any short text in Password, then click `Sign in`; check the email-format message and that no session starts.
3. Enter `anan@example.test` and a private test password, click `Show password`, check that the entered characters become visible, then hide them again before taking any screenshot.

Expected: Local validation blocks missing/malformed fields, the visibility control toggles only display, and no Ticket data appears before successful authentication.

### UAT-03 — Wrong and inactive credentials [AC-18, AC-19]

1. Enter `anan@example.test` with one intentionally wrong password and click `Sign in`.
2. Repeat once with `somchai.inactive@example.test` and the initial local seed password.
3. Observe the error text and the Password field after each attempt; stop after these two attempts so the real account is not rate-limited during the rest of UAT.

Expected: Both attempts show the same safe `Sign-in failed. Check your credentials or account status.` message, clear the Password field, and reveal no account-existence or inactive-status detail.

### UAT-04 — Mandatory first-login password change [AC-18]

1. Sign in as an active seeded account that still has its initial password; if all seeded accounts were already changed, perform this case after creating `U_EMPTY` in UAT-28.
2. On `Change your initial password before continuing`, try to open `/dashboard` directly in the same browser before changing the password.
3. Enter the current initial password, `short` as New password, and `different` as Confirm new password, then click `Change password`.
4. Replace New password and confirmation with the same new private value of 12–128 characters containing lowercase, uppercase, digit, and symbol, then submit.
5. Log out and sign in with the new password; do not put the password in evidence.

Expected: Protected navigation stays gated until change, invalid/mismatched values show field errors without changing credentials, the valid change enters the correct role shell, and the new password works on the next sign-in.

### UAT-05 — Role navigation, active page, and logout [AC-06, AC-16, AC-18]

1. Sign in as Anan and note `Dashboard`, `Create Ticket`, and `My Tickets` in the primary navigation; open each and check the active-page indication.
2. Log out, sign in as Narin, and note `Dashboard` and `Ticket Queue` without Requester or Users links.
3. Log out, sign in as Araya, and note `Dashboard`, `Ticket Review`, and `Users` without Requester creation links.
4. Log out, paste a previously visited protected URL into the address bar, and reload.

Expected: Each role has only its approved destinations, the current destination is indicated with text/focus styling and `aria-current`, and a logged-out browser returns to Sign in without protected content.

## 2. Requester creates the UAT data

### UAT-06 — Requester dashboard baseline [AC-12, AC-16]

1. Sign in as Anan, open `Dashboard`, and record the four card values: `Open Tickets`, `Waiting for You`, `Recently Updated`, and `Recently Resolved`.
2. Inspect `Needs your attention` and `Recent Tickets`, the displayed seven-UTC-day date range, and each card/list link.
3. Open one listed Ticket and return to Dashboard.

Expected: Every card has a number including zero, each visible row belongs to Anan, links open owned My Tickets filters or Ticket Detail, and no Staff metrics, IT Priority, Internal Notes, or another Requester's Ticket appears.

### UAT-07 — Create Ticket validation [AC-18, AC-19]

1. Open `Create Ticket` and click `Submit ticket` with all fields untouched.
2. Select `Network` and `Campus Wi-Fi`, enter `abc` as Summary and `short` as Description, then submit again.
3. Correct Summary to `UAT <RUN_ID> classroom Wi-Fi incident` and Description to `The classroom Wi-Fi disconnects during a video lesson and interrupts the Requester.`; keep Requested Priority at `Medium`.

Expected: Empty Category/Related System and short Summary/Description are blocked beside the correct fields with focus on the first invalid field; correcting one field preserves the other entries and does not create a Ticket until submission succeeds.

### UAT-08 — Create and record four independent Tickets [AC-18]

1. Submit the corrected form from UAT-07 and record the resulting Ticket number and URL as `T_MAIN`; check Status `New`, the authenticated Requester identity, Requested Priority `Medium`, and `No actions recorded for this Ticket yet`.
2. Use `Create Ticket` again to create `T_ACTION` with Category `Software`, Related System `LEB2 App`, Summary `UAT <RUN_ID> action lifecycle`, Description `Action lifecycle UAT needs separate completed and cancelled work items.`, and Requested Priority `Low`.
3. Create `T_STALE` with Category `Account and Access`, Related System `Email`, Summary `UAT <RUN_ID> concurrent Ticket edit`, Description `Two staff browser sessions will attempt to update this Ticket at the same time.`, and Requested Priority `Medium`.
4. Create `T_CANCEL` with Category `Hardware`, Related System `Printer`, Summary `UAT <RUN_ID> cancelled Ticket branch`, Description `This disposable Ticket will test Cancelled and Reopened workflow states.`, and Requested Priority `Low`; before submitting, use DevTools Network throttling so the request remains pending long enough to try a rapid second click on `Submit ticket`, then restore normal network.
5. Record all four Ticket numbers and URLs in the data register before continuing, then search My Tickets for `UAT <RUN_ID> cancelled Ticket branch` to verify that the repeated click did not create a duplicate.

Expected: Exactly four new Tickets appear in Anan's My Tickets list, each starts New with no Owner or Action, and clicking submit repeatedly while one request is in progress does not create duplicate Tickets.

### UAT-09 — My Tickets filters and owner isolation [AC-05, AC-12, AC-18]

1. Open `My Tickets` as Anan and locate the four UAT summaries and Anan's seeded Tickets.
2. Open `Dashboard` and click `View open tickets`; check the `Filter: open` summary, then use `Clear filters`.
3. Log out and sign in as Mali; open `My Tickets` and confirm that none of Anan's four UAT Tickets is listed.
4. Paste Anan's saved `T_MAIN` Requester-detail URL into Mali's browser and reload.

Expected: Anan sees only owned Tickets, the dashboard drill-down and Clear filters work, and Mali receives the same safe `We couldn't find this ticket.` result used for a missing Ticket without private data.

### UAT-10 — Public Comments and private-content boundary [AC-05, AC-18]

1. Sign back in as Anan and open `T_MAIN`; click `Post comment` with an empty `Add public comment` box.
2. Enter `UAT <RUN_ID>: The Wi-Fi drops during a class.` and click `Post comment`.
3. Sign in as Narin in Browser B, open the same Ticket through Ticket Queue, and check the new text in `Public Comments`.
4. As Narin, open `Internal Notes`, enter `UAT <RUN_ID>: Check the access-point logs privately.`, and click `Save internal note`.
5. Reload `T_MAIN` as Anan and inspect all visible sections.

Expected: Empty comment is blocked, the valid comment appears once with author/time for both roles, the Internal Note remains visible to Staff only, and Anan cannot see the Internal Notes tab or private note text.

## 3. IT Staff queue, ownership, and Ticket workflow

### UAT-11 — Staff dashboard baseline and Queue entry [AC-13, AC-16]

1. Sign in as Narin in Browser A and open Dashboard; record `Unassigned Tickets`, `My Tickets`, `My Active Actions`, every status and IT Priority bucket, and the three lists.
2. Click `View unassigned tickets` and check that the Queue shows `Filter: unassigned` and includes the new UAT Tickets while they have no Owner.
3. Use `Clear filters`, open `T_MAIN`, and return to Queue.

Expected: Cards and lists are numeric and linked, the Queue drill-down contains only eligible unassigned active Tickets, and Ticket links open a Staff detail screen rather than a Requester detail screen.

### UAT-12 — Queue search, filters, sorting, and no-results [AC-13, AC-18]

1. In Ticket Queue, enter `UAT <RUN_ID>` in `Search tickets` and check that the four new Ticket rows remain.
2. Filter Status `New`, Requested Priority `Medium`, IT Priority `Medium`, and Owner `Unassigned`; confirm that only matching rows remain and the result count changes coherently.
3. Change `Sort by` to Ticket number and `Direction` to Ascending, then reverse it; compare the first and last Ticket numbers.
4. Enter `no-ticket-matches-<RUN_ID>`, check `No tickets match`, then click `Clear filters` and use Page size/Previous/Next when enough rows exist.

Expected: Search/filter/sort/page state and visible rows agree, no-results has a clear recovery control, and no Ticket from another role is hidden from Staff merely because a different Requester submitted it.

### UAT-13 — Owner prerequisite before advanced status [AC-08]

1. Open `T_STALE` while it is New and unassigned; inspect available status controls, then click `Move to Open`.
2. In Open, inspect `Move to In Progress` before assigning an Owner; check that the button is disabled and read the helper text beside it.
3. Click `Claim ticket` as Narin, then click `Move to In Progress` and check the refreshed Ticket summary.

Expected: New offers only allowed targets, the owner-dependent move is disabled with `Assign an owner first`, claiming changes Owner to Narin, and the permitted move succeeds only after that prerequisite exists.

### UAT-14 — Claim, IT Priority, and zero-Action resolution gate [AC-08, AC-09, AC-13]

1. Open `T_MAIN` as Narin, check it has no Actions, click `Claim ticket`, and verify `Ticket Owner: Narin Support`.
2. Change `IT Priority` from Medium to High and click `Save IT Priority`; confirm Requested Priority remains Medium.
3. Move New → Open → In Progress using the visible status controls.
4. Click `Move to Resolved`, inspect the confirmation, and click `Confirm` while `T_MAIN` still has zero completed Actions.
5. Click `Show history` and compare the status and event list before and after the blocked attempt.

Expected: Claim and priority save refresh the summary; the High IT Priority makes `T_MAIN` eligible for Urgent Tickets; resolution is blocked with `Complete an action for this Ticket before resolving it`, status stays In Progress, and no false successful status event is appended.

### UAT-15 — Requester advisory indication [AC-10]

1. As Narin, move `T_MAIN` from In Progress to Waiting for Requester.
2. As Anan in Browser B, open `T_MAIN`, click `Problem appears resolved`, read the confirmation, and first click `Cancel`.
3. Open the confirmation again and click `Confirm`; reload Anan's detail.
4. Reload Narin's detail, inspect the Requester indication, and check the current Ticket status.
5. As Narin, move Waiting for Requester → In Progress, reload both views, and observe the previous-cycle signal behavior.

Expected: Cancel makes no change; Confirm records an advisory indication once without formally resolving the Ticket; Staff can see the signal; returning to In Progress clears that waiting-cycle signal under the workflow rules.

## 4. Actions Taken and the resolution cycle

### UAT-16 — Action create validation, date bounds, and draft retention [AC-02, AC-15, AC-19]

1. As Narin on `T_MAIN`, click `Add action`; note the labelled Action Date/Time, Action Description, Result, Assigned to, Follow-Up Required, Attachment Notes, and read-only Performed by.
2. Clear Action Description and click `Add action`; check that the first invalid field is focused and no Action appears.
3. Enter `Check the classroom access point`, set Action Date/Time earlier than the recorded Ticket creation time, and submit; check a field-safe date error and that the description remains.
4. Set Action Date/Time more than 365 days in the future and submit; check a field-safe date error and unchanged Action count.
5. Restore Action Date/Time to a valid current value, use DevTools Console `copy("X".repeat(2001))` to prepare 2,001 characters, paste into Action Description and submit, then repeat in Result with a short valid Description; check each 2,000-character limit separately and restore short valid text before the next step.
6. Use `copy("X".repeat(501))` in Attachment Notes and submit, restore a short valid note, then check Follow-Up Required and use `copy("X".repeat(1001))` in Follow-Up Note; check the corresponding 500/1,000-character errors separately without saving.
7. Restore short valid text, click `Close`, decline the browser's discard confirmation, and verify the draft is still present; then close and accept discard so UAT-17 starts with a clean form.

Expected: Invalid fields show errors beside the correct control, preserve other entries, focus the first invalid field where applicable, and create no Action; Performed by is never editable; dirty Close requires a discard decision.

### UAT-17 — Required follow-up and one Planned Action [AC-01, AC-02, AC-05, AC-15]

1. As Narin on `T_MAIN`, click `Add action` and leave the default Action Date/Time unless it precedes this Ticket's creation time.
2. Enter Action Description `UAT <RUN_ID> inspect classroom access point`, Result `The access point needs a configuration change`, Assigned to `Unassigned`, and Attachment Notes `See the existing Ticket attachment if one is added later.`.
3. Check `Follow-Up Required`, leave Follow-Up Note empty, and click `Add action`.
4. Fill Follow-Up Note with `Ask Anan to retest Wi-Fi after the next class`, then click `Add action` once and record this Action as `A_MAIN`.
5. Expand `View action` and inspect Action Date/Time, Description, Result, Performed by, Assigned to, Follow-Up Required, Follow-Up Note, Attachment Notes, Created, and Updated.

Expected: The empty conditional note blocks submission; the valid save creates exactly one Planned Action under `T_MAIN`, shows `Follow-up: Required`, sets Performed by to Narin from the session, and leaves Assigned to Unassigned without changing Ticket Owner.

### UAT-18 — Assignment and reassignment are separate from ownership [AC-03, AC-04]

1. Expand `A_MAIN`, click `Assign`, choose `Kanda Service`, and click `Save assignment`.
2. Confirm the Action now says Assigned to Kanda while Ticket Owner remains Narin and Performed by remains Narin.
3. Click `Reassign`, select `Thep Technician`, cancel the browser confirmation, and check that the assignee is still Kanda.
4. Repeat the reassignment and accept the confirmation; then reassign from Thep back to Kanda with confirmation so UAT-20 has Kanda as the current assignee.

Expected: First assignment and confirmed reassignment change only the Action assignee, cancelled confirmation does nothing, and Ticket Owner/Performer never change as a side effect.

### UAT-19 — Content edit and unchanged Action time [AC-04, AC-07, AC-15]

1. Record the displayed Action Date/Time of `A_MAIN`, click `Edit action`, and confirm the existing Description, Result, Follow-Up Note, and Attachment Notes are prefilled.
2. Change Result to `Configuration corrected; classroom connection is stable`, leave Action Date/Time untouched, and click `Save action`.
3. Reload the Ticket and verify the new Result, the same Action Date/Time, the same Performed by, and a later Updated time.
4. Open Edit again, type `unsaved UAT draft` at the end of Description, click `Close`, and first decline then accept the discard confirmation.

Expected: Editing approved content preserves an untouched Action time and immutable performer; the saved Result appears after reload; declining discard keeps the draft and accepting discard leaves the saved Action unchanged.

### UAT-20 — A different Staff member starts and completes the Action [AC-04, AC-06, AC-09]

1. Keep Narin's `T_MAIN` detail open in Browser A and sign in as Kanda in Browser B; open `T_MAIN` through Ticket Queue.
2. Expand `A_MAIN`, click `Start`, read the Planned → In Progress confirmation, and click `Confirm`.
3. Reload and confirm In Progress and its visible status text; then click `Complete` and confirm the transition.
4. Reload as both Kanda and Narin and inspect status, Result, Completed actor/time, Performer, Assignee, and Ticket Owner.

Expected: Kanda may act as current assignee without becoming Ticket Owner; the Action becomes Completed with Kanda as completer, Narin remains performer and Ticket Owner, and no edit/start/complete/cancel controls remain on the terminal Action.

### UAT-21 — Formal resolution, close, reopen, and old-work gate [AC-08, AC-09, AC-11]

1. As Narin, refresh `T_MAIN` after `A_MAIN` is Completed and click `Move to Resolved`; read the In Progress → Resolved confirmation and click `Confirm`.
2. Check the summary status and `Workflow history`, then click `Move to Closed` and confirm.
3. Click `Move to Reopened` and confirm; check the Ticket status and that the old Completed `A_MAIN` is still visible.
4. Try `Move to Resolved` without completing a new Action after reopening, confirm the dialog, and inspect the error and history.

Expected: The qualifying completion permits the first formal resolution; Closed and Reopened append history without erasing `A_MAIN`; the pre-Reopened completion does not satisfy the new cycle, so the second resolution is blocked with no new successful status event.

### UAT-22 — New-cycle direct completion restores resolution [AC-04, AC-09, AC-11]

1. On reopened `T_MAIN`, click `Add action` and enter Description `UAT <RUN_ID> verify reopened Wi-Fi`, Result `Reopened issue fixed and verified`, Assigned to `Narin Support`, and Follow-Up Required unchecked.
2. Save and record the new Planned item as `B_MAIN`; expand it and click `Complete` directly without clicking Start.
3. Confirm completion, then move `T_MAIN` from Reopened to Resolved and confirm.
4. Open Workflow history and compare the ordered events before and after the new-cycle Action and status change.

Expected: Planned → Completed is allowed when the assignee and saved Result are valid; the new completion qualifies after Reopened; resolution succeeds; earlier events remain ordered and unchanged.

### UAT-23 — Separate direct-complete and two cancellation paths [AC-04, AC-15]

1. As Narin, open `T_ACTION`, click `Claim ticket`, and keep it nonterminal for the remaining Action cases.
2. Create `A_DIRECT` with Description `UAT <RUN_ID> direct completion`, Result `Already verified`, Assigned to Narin, and no follow-up; expand it and click `Complete` directly from Planned.
3. Create `A_CANCEL_PLANNED` with Description `UAT <RUN_ID> duplicate check`, Result `Superseded`, and Assigned to Unassigned; click `Cancel action`, try Confirm with an empty reason, then enter `Duplicate work item` and confirm.
4. Create `A_CANCEL_PROGRESS` with Description `UAT <RUN_ID> inspection no longer needed`, Result `Investigation started`, and Assigned to Narin; click Start and confirm, then click Cancel action, enter `Requester withdrew this work`, and confirm.

Expected: Direct completion works with an assignee and Result, unassigned Planned cancellation is allowed for the creator, In Progress cancellation needs a nonblank reason, and each terminal Action records its own final state without turning the other Actions terminal.

### UAT-24 — List order, terminal immutability, and Requester shared view [AC-05, AC-11, AC-15]

1. As Narin, inspect all Actions on `T_ACTION`, including the Completed and both Cancelled items, and compare their Action Date/Time order; open each terminal detail.
2. Confirm no Edit, Assign/Reassign, Start, Complete, or Cancel action control appears on a terminal item; check Staff can see its cancellation reason where applicable.
3. As Anan in Browser B, open `T_ACTION`, expand every Action, and compare descriptions, results, performer, assignee, follow-up, notes, timestamps, and status with the Staff view.
4. Look for Action write controls, Action event/audit history, cancellation reason, and Internal Notes in Anan's view.

Expected: Every Action remains visible in stable Action Date/Time order regardless of status or performer; Requester sees the approved shared fields and none of the write controls or private Staff-only data.

## 5. Administrator and User Management

### UAT-25 — Administrator dashboard, Ticket read-only boundary, and Action permission [AC-06, AC-13]

1. Sign in as Araya, open Dashboard, and inspect the Staff-style cards, status/priority distributions, lists, and `Ticket Review` navigation.
2. Open `T_ACTION` from Ticket Review; confirm the callout says `Ticket workflow is read-only for Administrators; Actions Taken may be managed here`.
3. Look for Claim, Owner, IT Priority, Ticket status, Public Comment composition, and Internal Note composition controls.
4. In the Actions Taken section, click `Add action`, enter Description `UAT <RUN_ID> admin diagnostic`, Result `Reviewed by Administrator`, Assigned to Araya, and save.
5. Expand the new Action, edit the Result, then Start and Complete it with the displayed confirmations.

Expected: Existing Staff Ticket mutations remain unavailable to Administrator while Administrator Action creation, edit, and permitted lifecycle operations work under the same Action actor rules; the Action is shared with Anan on `T_ACTION`.

### UAT-26 — User list, search, filters, and two disposable accounts [AC-18]

1. In `Users`, inspect seeded names, emails, roles, Active/Inactive badges, and password-change indicators; search for `Narin` and then clear the search.
2. Filter Role to IT Staff and confirm Requester rows disappear; clear the filter.
3. Click `Create user` and create `U_STAFF` with Display name `UAT Staff <RUN_ID>`, the email in the data register, Role IT Staff, Active checked, and a private initial password entered identically in both password fields.
4. Create `U_EMPTY` with Display name `UAT Empty <RUN_ID>`, its registered email, Role Requester, Active checked, and a separate private initial password.
5. Search for each account and record its exact email and displayed status.

Expected: Search and one-role filter narrow the list, both new users appear once with one role and password-change-required state, and no password value is displayed in the list or success message.

### UAT-27 — User form validation, duplicate email, and unsaved-change guard [AC-18, AC-19]

1. Click `Create user` and submit the empty panel; check required field errors.
2. Enter Display name `A`, Email `bad-email`, Role IT Staff, Initial password `short`, and mismatched confirmation, then submit.
3. Correct the name and password but use `anan@example.test` as Email; submit and check the duplicate-email error without losing the other fields.
4. Change Email to an unused UAT address, type an unsaved name change, click `Cancel`, choose `Keep editing`, then click Cancel again and choose `Discard`; do not create this extra account.

Expected: Invalid name/email/password/confirmation are blocked beside fields, duplicate email is rejected safely, and the discard dialog prevents accidental loss of a dirty form.

### UAT-28 — Administrator self-protection and owned-Ticket guard [AC-18, AC-19]

1. Edit Araya's own row and try to change Role or uncheck Active.
2. Close that panel and edit Narin's row, uncheck Active, click `Save changes`, and confirm the warning.
3. Recheck Active in Narin's unsaved form, then try to change Narin's Role to Requester while Narin still owns `T_MAIN`, `T_ACTION`, and `T_STALE`.
4. Reopen Narin's row and check the saved role and active status.

Expected: Araya cannot change her own role or deactivate herself in the UI; deactivating or demoting Narin is blocked with guidance to reassign owned Tickets first; Narin remains an active IT Staff user.

### UAT-29 — Reset initial password and session revocation [AC-18, AC-19]

1. Sign in as `U_STAFF` in Browser B with its private initial password, change that password at the mandatory gate, and leave its Dashboard open.
2. As Araya in Browser A, edit `U_STAFF`, click `Set new initial password`, enter a new private policy-compliant value twice, and click `Set password`.
3. Reload Browser B's protected page, then try to sign in with the old password and with the newly set initial password.
4. Complete the mandatory second password change with another private valid value and record the new current password privately for UAT-40.

Expected: Reset warns about the account, ends the prior session, rejects the old password, accepts the new initial password, and requires another password change before protected navigation; the completed change restores the Staff shell and no password is echoed by the UI.

## 6. Concurrent users, recoverable failures, and remaining workflow branches

### UAT-30 — Inactive assignee rejected after the picker becomes stale [AC-03, AC-15, AC-19]

1. As Narin in Browser A, open `T_ACTION`, create a new unassigned Planned Action `A_INACTIVE` with Description `UAT <RUN_ID> inactive assignee race` and leave its Result empty.
2. Expand `A_INACTIVE`, click `Assign`, select the still-active `U_STAFF`, and keep the Assign action dialog open without submitting.
3. As Araya in Browser B, edit `U_STAFF`, uncheck Active, save, and confirm the session-revocation warning; this user owns no Ticket, so deactivation should succeed.
4. Return to Browser A and click `Save assignment` without refreshing the stale picker; inspect the field error and the Action details.
5. Reload Browser A and open Assign again; then, in Browser B, reactivate `U_STAFF` for any later role-change test.

Expected: The real write is rejected because the selected user is inactive, the dialog retains the selected draft and shows an assignee-specific error, `A_INACTIVE` remains Unassigned with no false assignment event, and a newly loaded picker excludes the inactive user until reactivation.

### UAT-31 — Two-session Action edit collision [AC-07, AC-19]

1. As Narin on owned `T_ACTION`, create Planned `A_STALE` with Description `UAT <RUN_ID> concurrent Action`, Result `Initial result`, and Assigned to Kanda.
2. In Browser A as Narin, open `A_STALE` → `Edit action` and change Description to `Narin unsaved draft`; do not save.
3. In Browser B as Kanda, reload `T_ACTION`, open the same Action → Edit action, change Result to `Kanda saved result`, and save.
4. Return to Browser A and click `Save action`, then inspect the conflict message, the still-entered Description, and the `Refresh action` control.
5. Click `Refresh action`, inspect the latest server values, then use `Continue with draft` only if you intentionally want to retry; leave the final saved value clear in your UAT record.

Expected: Browser A receives a stale conflict instead of overwriting Kanda's result, retains Narin's draft, focuses safe conflict feedback, and requires an explicit refresh/choice before another write; there is no duplicate event for the rejected attempt.

### UAT-32 — Follow-up toggle, plain text, and Attachment Notes [AC-02, AC-05, AC-15]

1. As Narin on `T_ACTION`, create a Planned Action with Description `UAT <RUN_ID> literal <img src=x onerror=alert(1)> text`, Result empty, Follow-Up Required checked, Follow-Up Note `Retest tomorrow`, and Attachment Notes `See the existing Ticket attachment; this text is not an upload.`.
2. Reload the Staff detail and Anan's Requester detail; read the Action in both views and watch for any unexpected popup or rendered image.
3. As Narin, edit the still-Planned Action, uncheck Follow-Up Required, save, and reload both views.

Expected: The HTML-looking characters display as literal text with no script execution; Attachment Notes only store text and never upload a file; clearing the follow-up flag removes the note only after the explicit save, while other content remains intact.

### UAT-33 — Network failure, retry, and repeated-submit protection [AC-01, AC-07, AC-15, AC-19]

1. As Narin on `T_ACTION`, open Add action and enter Description `UAT <RUN_ID> retry once`, Result `Verified after reconnection`, Assigned to Narin, and a valid Action Date/Time.
2. With the page already loaded, use DevTools Network to switch the browser Offline, then click `Add action`; do not reload the whole page.
3. Check the failure message and every field value, restore Online, and submit the same draft again while watching the button's busy state.
4. Click the submit control rapidly twice only while the first real request is pending, then reload the Ticket and count Actions with this unique Description.

Expected: A recoverable network failure leaves the important draft intact, the retry succeeds once, the busy control prevents a second in-flight create, and exactly one Action with this unique Description exists; record a Fail if two are created.

### UAT-34 — Two-session Ticket version collision [AC-07, AC-08, AC-19]

1. Keep `T_STALE` at In Progress with Narin as Owner; open its detail in Browser A as Narin and Browser B as Kanda.
2. In Browser B, move In Progress → Waiting for Requester and confirm the new status.
3. Without refreshing Browser A, click its still-visible `Move to Cancelled`, accept the confirmation, and inspect the conflict feedback.
4. Reload both browsers and open Workflow history.

Expected: Browser A's stale write is rejected without replacing Browser B's Waiting for Requester status, only the winning transition appears in history, and the stale page offers Refresh before another attempt.

### UAT-35 — Cancelled Ticket and Reopened branch [AC-08, AC-11]

1. As Narin, open the still-New, unassigned `T_CANCEL` and click `Move to Cancelled`.
2. Read the New → Cancelled confirmation, click Cancel once, then repeat and click Confirm.
3. Check that Cancelled has no Action write control, then click `Move to Reopened` and confirm.
4. Claim the reopened Ticket, move it to In Progress, and inspect Workflow history after each change.

Expected: Cancel in the confirmation leaves New unchanged; Confirm produces Cancelled; Action writes are unavailable while Cancelled; Reopened restores eligible work, and each successful transition appends one ordered event.

## 7. Dashboard calculations, role isolation, and empty/failure states

### UAT-36 — Requester metric deltas and drill-down [AC-12, AC-14]

1. Sign in as Anan and compare Dashboard with the baseline recorded in UAT-06 and the current statuses of `T_MAIN`, `T_ACTION`, `T_STALE`, and `T_CANCEL`.
2. Check that each currently New/Open/In Progress/Waiting/Reopened owned Ticket contributes to Open Tickets; a currently Resolved or Closed Ticket does not.
3. Check Waiting for You against owned Waiting for Requester Tickets, Recently Updated against owned Tickets changed within the displayed seven-UTC-day range, and Recently Resolved against Tickets currently Resolved whose last status change is in that range.
4. Click each of the four card links, inspect the matching `Filter:` summary and Ticket rows, then click Clear filters; open one attention/recent list link.
5. Sign in as Mali and repeat the visible Ticket comparison for her Dashboard, checking that none of Anan's UAT Ticket numbers appears.

Expected: Counts match the defined owned Ticket sets rather than merely the number of list rows; lists show at most five entries; drill-down membership agrees with its card predicate and UTC range; another Requester's records never leak.

### UAT-37 — Staff counts, current-user Actions, and urgent/recent lists [AC-13, AC-14]

1. As Narin, compare Unassigned Tickets with active Queue rows lacking Owner, My Tickets with active rows owned by Narin, and My Active Actions with Planned/In Progress Actions assigned specifically to Narin on nonterminal Tickets.
2. Check all eight Tickets by Status buckets and the Low/Medium/High IT Priority buckets against the corresponding Queue filters, including zero buckets.
3. Check that `T_MAIN` appears in Urgent Tickets only while nonterminal and High IT Priority, and that recent rows lie in the displayed UTC range; open their links.
4. Click `View my active actions`; compare the card's Action count with the Queue's matching Action count per Ticket, noting that a Ticket with two qualifying Actions appears as one Ticket row.
5. Sign in as Kanda, repeat My Tickets/My Active Actions checks, and verify that Narin's assigned Actions are not counted as Kanda's.

Expected: All dashboard values and filtered Queue results agree with persisted Ticket/Action state; `My` uses the current signed-in person, recent/urgent/current-user lists have at most five entries, and the Queue explains Action count versus distinct Ticket rows.

### UAT-38 — Administrator dashboard uses self-scoped `My` metrics [AC-06, AC-13]

1. Sign in as Araya, open Dashboard, and compare the three cards, all status/priority buckets, and recent/urgent lists with Staff views.
2. Confirm the Completed Administrator Action from UAT-25 is no longer in Araya's My Active Actions; create one fresh Planned Action assigned to Araya on still-active `T_ACTION`, refresh Dashboard to verify the card/list increases for Araya only, then complete or cancel that disposable Action and verify the count drops after refresh.
3. Open a dashboard Ticket link, inspect Ticket Review's read-only workflow and permitted Action area, then return to Dashboard.

Expected: Administrator sees the Staff-style operational dashboard and all-Ticket distributions, but My counts use Araya's identity and Ticket operations remain read-only.

### UAT-39 — Empty Requester dashboard and safe Retry [AC-12, AC-14, AC-16, AC-19]

1. Sign in as newly created `U_EMPTY`, complete its mandatory first-password change, and open Dashboard before creating any Ticket.
2. Check all four cards and both lists, then click one zero card and inspect its empty My Tickets filter page.
3. Return to My Tickets, switch DevTools Network Offline, click Dashboard through the client navigation, and observe the loading/failure state without reloading the full app.
4. Restore Online and click `Retry`.

Expected: All new-Requester cards show 0, lists have specific empty copy, zero-card drill-down is usable, the failed dashboard does not present stale numbers as current, and Retry restores valid data without leaking another role's payload.

### UAT-40 — Role change and direct-route protection [AC-06, AC-14, AC-18, AC-19]

1. After UAT-30 has reactivated `U_STAFF`, sign in as that user in Browser B and leave its Staff Dashboard open.
2. As Araya, edit `U_STAFF`, change Role from IT Staff to Requester, save, and confirm the session-revocation dialog.
3. Reload Browser B, sign in with the account's current private password, and inspect the navigation; paste `/staff/tickets`, `/admin/users`, and a Staff Ticket Detail URL into the address bar one at a time.
4. As Anan, try `/staff/tickets` and `/admin/users`; as Narin, try `/tickets/new` and `/admin/users`; as Araya, try `/tickets/new`.

Expected: Role change ends the old Staff session, the new Requester sees only Requester navigation, direct routes show Access restricted or the approved safe response, and hiding links never substitutes for backend authorization.

### UAT-41 — Full Ticket transition-control sweep [AC-08, AC-09]

1. Use the four UAT Tickets and additional fresh disposable Requester Tickets if needed to reach each source status below through permitted UI transitions; do not edit seeded examples or force a database status.
2. At each source status, record exactly which `Move to ...` buttons appear, whether an active Owner is required, and whether a confirmation dialog names the source and target.
3. Attempt each displayed target once on a disposable Ticket, satisfying Owner and current-cycle Completed Action prerequisites where specified; for Resolved, Closed, Cancelled, and Reopened, cancel one dialog before confirming it.
4. Verify the current status and Workflow history after every successful and rejected attempt; use Section 9 to verify that a forged omitted pair is also rejected by the backend.

| Source status | Permitted target controls | Additional condition |
| --- | --- | --- |
| New | Open, Cancelled | No Owner required. |
| Open | In Progress, Waiting for Requester, Cancelled | Owner required for In Progress and Waiting. |
| In Progress | Waiting for Requester, Resolved, Cancelled | Owner required; Resolved also needs current-cycle Completed Action. |
| Waiting for Requester | In Progress, Resolved, Cancelled | Owner required; Resolved also needs current-cycle Completed Action. |
| Resolved | Closed, Reopened | Owner required for Closed; a legacy already-Resolved Ticket may close without creating a new Action. |
| Closed | Reopened | Confirmation required. |
| Reopened | In Progress, Waiting for Requester, Resolved, Cancelled | Owner required; Resolved also needs a post-Reopened Completed Action. |
| Cancelled | Reopened | Confirmation required. |

Expected: Only listed transitions appear and succeed under their conditions, every omitted source/target pair is unavailable and rejected by the API, and confirmation never bypasses Owner or Action gates.

## 8. Responsive layout, keyboard access, and visual quality

### UAT-42 — Desktop, tablet, mobile, and real 200% zoom [AC-15, AC-16]

1. At 1440×900, 820×1180, and 390×844 CSS viewport sizes, inspect Requester Dashboard/My Tickets/Ticket Detail, Staff Dashboard/Queue/Ticket Detail, Administrator Dashboard/Ticket Review/Users, and Action list/create/edit/assign/read-only modes.
2. At 390×844, use the `Menu` control to reach role navigation; scroll each Action modal internally to its lower submit/close controls.
3. On a desktop browser at a 1440×900 window, set actual browser zoom to 200% and revisit Dashboard, Action create/edit/assign, workflow error feedback, and User Management.
4. At each width and zoom, try a long Action Description, long Ticket summary, validation message, and status badge; look for page-level horizontal scrolling, clipped text, overlapping buttons, hidden dialogs, or unreachable controls.

Expected: Every major screen remains readable and operable, mobile controls have usable touch targets, the modal's lower controls are reachable, and no page-level overflow or content collision prevents a task.

### UAT-43 — Keyboard, focus, semantic labels, and dialogs [AC-15, AC-16]

1. Without using a mouse, press Tab from the top of Login, then from each authenticated role shell; check the Skip to main content link, visible focus, role navigation order, and active-page cue.
2. Open the mobile Menu with Enter, navigate its links with Tab, close it with Escape, and check focus returns to Menu.
3. Open Add action, intentionally submit an empty Description and Follow-Up Note, and check focus reaches the first invalid field and each field has a readable error.
4. Open an Action confirmation, Ticket status confirmation, and User Management reset dialog; check their accessible title, Tab/Shift+Tab containment, Escape or Cancel behavior, and focus return to the triggering control.
5. As IT Staff, navigate Public Comments, Internal Notes, and Attachments tabs by keyboard and check that status/priority meaning is written as text rather than color alone.

Expected: Every control is reachable by keyboard, focus is visibly marked, errors are associated with fields, dialogs do not lose focus, and status/priority/private-versus-shared information remains understandable without color.

### UAT-44 — Zen Green consistency, console, links, and plain copy [AC-16, AC-18]

1. Compare cards, buttons, forms, badges, tables, tabs, alerts, and spacing across the three role dashboards and their Ticket screens.
2. Open browser DevTools Console after a successful sign-in, navigate normal happy-path screens, and note any uncaught error or missing resource; ignore only the expected unauthenticated session probe before login.
3. Click representative dashboard cards, Ticket links, Action deep links, Queue filter links, Back links, Clear filters, and Retry controls; inspect for blank destinations or `#` placeholder links.
4. Search visible screens for `TODO`, `Lorem ipsum`, `Coming soon`, duplicated obsolete controls, or unexplained technical error text.

Expected: The product remains visually coherent, normal authenticated navigation has no console errors or broken links, and no placeholder/unfinished UI is exposed.

## 9. Controlled API, data, and recovery checks

These checks use the disposable UAT environment from Section 0 and a tool such as Postman with its cookie jar. They verify backend rules that a hidden UI button cannot prove. For each actor, `POST /api/auth/login` with the configured client `Origin` and JSON `{ "email": "<ACTOR_EMAIL>", "password": "<PRIVATE_CURRENT_PASSWORD>" }`; retain the session cookie in the tool and use the response `data.csrfToken` privately as `X-CSRF-Token` on unsafe requests. Copy each Ticket UUID from its saved detail URL and each Action UUID from that Ticket's `GET /api/tickets/{TICKET_ID}/actions` response; the display Ticket number is not an API path ID. Do not paste the cookie, token, password, or a full authenticated request into the UAT report.

### UAT-45 — Direct API authorization, ownership, and CSRF [AC-05, AC-06, AC-14, AC-19]

1. Without a session cookie, send `GET /api/dashboard/requester` and `GET /api/tickets/{T_MAIN_ID}/actions`.
2. As Anan, send `GET /api/dashboard/staff`, then send `POST /api/tickets/{T_ACTION_ID}/actions` with allowed Origin, valid CSRF header, a fresh UUID `Idempotency-Key`, and JSON `{ "ticketVersion": <CURRENT_TICKET_VERSION>, "actionAt": "<CURRENT_UTC_ISO>", "description": "UAT denied Requester Action", "result": "", "assigneeId": null, "followUpRequired": false, "followUpNote": null, "attachmentNotes": null }`; copy the current version from an owned Ticket detail first.
3. As Mali, send `GET /api/tickets/{T_MAIN_ID}/actions` and compare its response with the response for a well-formed but nonexistent Ticket UUID.
4. As Araya, send `PATCH /api/staff/tickets/{T_ACTION_ID}/status` with allowed Origin, valid CSRF header, and JSON `{ "version": <CURRENT_TICKET_VERSION>, "status": "OPEN" }`; as Narin, send that same otherwise valid request once without `X-CSRF-Token` and once with a disallowed `Origin`.
5. As Anan, request `GET /api/tickets/{T_ACTION_ID}/actions/{A_DIRECT_ID}/events` using the Action ID returned by the owned Action list.
6. As Narin, while `T_ACTION` is still New, send the same status endpoint with allowed Origin, valid CSRF header, the latest Ticket version, and JSON `{ "version": <CURRENT_TICKET_VERSION>, "status": "RESOLVED", "confirmed": true }` to test the forbidden New → Resolved pair from UAT-41.
7. Reload the affected Tickets in the UI and confirm that no denied request changed status, Action count, Owner, or history.

Expected: Unauthenticated reads return 401; forbidden role-wide calls return 403; Mali's cross-owner Ticket/Action read returns the same safe 404 shape as an absent Ticket; missing CSRF or wrong Origin returns 403; Requester Action-event history returns 403; the forged New → Resolved pair returns 409 `INVALID_STATUS_TRANSITION`; none of these calls mutates data or reveals private fields.

### UAT-46 — Idempotent Action creation, protected fields, and stale version [AC-01, AC-02, AC-07, AC-19]

1. As Narin in Postman, read `GET /api/staff/tickets/{T_ACTION_ID}` and copy only the numeric `data.version` into a private request variable; obtain one current UTC ISO timestamp with a `Z` suffix and one new UUID for `Idempotency-Key`.
2. Send `POST /api/tickets/{T_ACTION_ID}/actions` with the valid header and exactly this JSON shape, replacing placeholders: `{ "ticketVersion": <VERSION>, "actionAt": "<CURRENT_UTC_ISO>", "description": "UAT <RUN_ID> API idempotency", "result": "", "assigneeId": null, "followUpRequired": false, "followUpNote": null, "attachmentNotes": null }`.
3. Record the returned Action ID and resend the identical request with the identical Idempotency-Key and body.
4. Keep the same key but change Description to `UAT <RUN_ID> changed payload`; then try a new key with the original stale Ticket version.
5. Fetch the Ticket's latest version, use a fresh idempotency key, then try an Action create body that adds a forged `performedByUserId`, `createdByUserId`, or `status`; inspect the safe error without retrying it as a legitimate write.
6. Reload `T_ACTION` in the UI and count Actions with the API idempotency Description; inspect Workflow history or Action events as Staff if needed.

Expected: First and identical replay return the same 201 body/Action ID and only one Action/event; changed-payload key reuse returns 409 `IDEMPOTENCY_KEY_REUSED`; a fresh key with stale version returns 409 `STALE_TICKET`; protected actor/status fields are rejected without changing the authenticated performer or creating another Action.

### UAT-47 — Attachment API and the visible Ticket link [AC-18, AC-19]

1. As Anan in Postman, send multipart `POST /api/tickets/{T_ACTION_ID}/attachments` with exactly one valid small PNG or PDF part named `file`, the allowed Origin, and X-CSRF-Token.
2. Save the returned Attachment ID, send `GET /api/tickets/{T_ACTION_ID}/attachments`, then open `T_ACTION` as Anan in the browser and click the new Attachment download link.
3. Open the same Ticket as Narin and Araya and confirm the file is visible for read; as Mali, try `GET /api/attachments/{ATTACHMENT_ID}/download`.
4. As Anan, send `DELETE /api/attachments/{ATTACHMENT_ID}` with JSON `{ "reason": "UAT evidence no longer needed" }`, the allowed Origin, and X-CSRF-Token; reload the Requester and Staff Ticket screens.

Expected: Owned upload/list/download succeed, Staff/Administrator can read without upload/removal controls, Mali gets safe 404, soft removal returns a removed state and leaves a `(removed)` label without a live download link. Attachment upload/removal is an API workflow in this increment; the Ticket UI lists and downloads existing Attachments, and Action `Attachment Notes` do not upload files.

### UAT-48 — Process health and database dependency failure [AC-14, AC-18, AC-19]

1. In the disposable UAT environment only, record a working Dashboard response and a working `GET /api/health` response.
2. Temporarily stop or disconnect only that disposable PostgreSQL instance while leaving the API process running; do not do this against a shared or `public` database.
3. Repeat `GET /api/health`, then call the authenticated Requester or Staff dashboard and one affected Ticket/Action data endpoint.
4. Restore PostgreSQL, click a visible `Retry` control in the client, and confirm that normal data returns without stale cross-role content.

Expected: Health remains HTTP 200 with the exact process-liveness JSON from UAT-01, affected data endpoints return a safe 503 error envelope without SQL/stack/storage/token details or partial writes, and recovery restores normal operation. If you cannot isolate the database, mark this case Blocked and use the executed automated safe-failure test as separate evidence; do not claim a manual Pass.

### UAT-49 — Seed, migration, and backup/restore integrity [AC-11, AC-17]

1. On a separate scratch database/schema with only synthetic data, record pre-migration counts for User, Ticket, Attachment, PublicComment, and InternalNote plus one legacy Ticket's Owner/status/Attachment relationship.
2. Follow `docs/lab-04/actions-migration.md` to deploy the committed Lab 4 migration, then compare all recorded counts and relationships; inspect one migrated Ticket with no Actions and its `State observed during migration` baseline.
3. Run the seed command twice in that scratch environment and compare User/Ticket/Action counts and IDs after each run; edit one disposable Action between seeds and check that the later seed does not erase the edit.
4. For a separate scratch database, run `pg_dump --format=custom --no-owner --no-acl --file=<SCRATCH_DUMP> <SCRATCH_DATABASE>`, create an empty second database with `createdb <RESTORE_DATABASE>`, and run `pg_restore --no-owner --no-acl --dbname=<RESTORE_DATABASE> <SCRATCH_DUMP>`; compare the same entity counts and one Ticket→Action→Attachment relationship, then retain only a checksum/manifest in the UAT record.

Expected: Earlier records and joins survive, no fake Action is synthesized for a zero-action legacy Ticket, the baseline has no invented historical actor, repeat seed does not duplicate or overwrite existing Action state, and restore into a separate database reproduces the recorded counts. Never restore over a database with newer Action writes.

### UAT-50 — Query-backed dashboard and complete automated gate [AC-12, AC-13, AC-17, AC-18, AC-20]

1. On the UAT schema, use the SQL/Prisma comparison examples in `docs/lab-04/tests.md` to count Anan's current Open Tickets and Narin's current active assigned Actions; compare them with their cards at the same point in the run.
2. Verify the resolved test database URLs, whether configured by `TEST_DATABASE_URL` and `PLAYWRIGHT_DATABASE_URL` overrides or their runner defaults, point only to separate expendable test schemas; neither may target the UAT schema or `public` before running test commands.
3. Run `npm --prefix server run build`, `npm --prefix client run build`, `npm run test:server`, `npm run test:client`, `npm run test:e2e`, and `npm run test:visual`; record command, date, exit code, counts, and any failure trace.
4. From `server/` in PowerShell, run the opt-in performance smoke on its isolated server test schema using the commands below; record dataset size, machine, request count, and actual p95 timings rather than copying an earlier machine's result.

```powershell
$env:LAB4_PERF_SMOKE = '1'
npx vitest run tests/lab-04/dashboard-performance.test.ts
Remove-Item Env:LAB4_PERF_SMOKE
```

5. Check the AC-01 through AC-20 rows and test paths in `docs/lab-04/tests.md`, then record whether every mandatory UAT case in this document passed or which IDs remain Fail/Blocked.

Expected: Query counts and cards agree, all build/test commands pass against isolated schemas, the local 1,000-Ticket/5,000-Action performance smoke remains below its documented 2,000 ms p95 smoke threshold, and no AC is declared complete from a skipped or failed check.

## 10. Execution log and acceptance decision

Copy one row per UAT ID into the run log; do not mark a step Pass merely because an automated test covers the same rule.

### Minimum visual evidence to capture

| Evidence group | UAT IDs | What the image must show |
| --- | --- | --- |
| Entry and ownership | UAT-01, UAT-08, UAT-09 | Sign-in without secrets, new Ticket number/status, and safe cross-owner not-found state. |
| Workflow gate | UAT-14, UAT-15, UAT-21, UAT-22 | Zero-action block, Requester advisory signal, first resolution, post-Reopened block, and new-cycle success. |
| Actions Taken | UAT-17, UAT-18, UAT-20, UAT-23, UAT-24 | Follow-up validation, distinct Owner/Performer/Assignee, assignment, completed/cancelled states, and Requester read-only details. |
| Conflicts and failure | UAT-30, UAT-31, UAT-33, UAT-34 | Inactive-assignee error with retained selection, Action draft after stale conflict, network-failure draft, and Ticket stale feedback. |
| Dashboards and roles | UAT-36, UAT-37, UAT-38, UAT-39 | Requester/Staff/Administrator cards, drill-down filter summary, a self-scoped Action count, and an all-zero new Requester view. |
| Layout and accessibility | UAT-42, UAT-43 | Dashboard, Action create/edit/assign/read-only at desktop/tablet/mobile and actual 200% zoom, plus one visible keyboard-focus/error example. |

Save the corresponding actual values or sanitized HTTP status/error-code notes for API-only cases UAT-45 through UAT-50; a screenshot of a password, cookie, token, or database connection string is never evidence.

| UAT ID | Result: Pass / Fail / Blocked | Actual result and deviation | Browser / viewport / date | Screenshot or request evidence | Defect ID |
| --- | --- | --- | --- | --- | --- |
| UAT-01 | Not run |  |  |  |  |
| UAT-02 | Not run |  |  |  |  |
| UAT-03 | Not run |  |  |  |  |
| UAT-04 | Not run |  |  |  |  |
| UAT-05 | Not run |  |  |  |  |
| UAT-06 | Not run |  |  |  |  |
| UAT-07 | Not run |  |  |  |  |
| UAT-08 | Not run |  |  |  |  |
| UAT-09 | Not run |  |  |  |  |
| UAT-10 | Not run |  |  |  |  |
| UAT-11 | Not run |  |  |  |  |
| UAT-12 | Not run |  |  |  |  |
| UAT-13 | Not run |  |  |  |  |
| UAT-14 | Not run |  |  |  |  |
| UAT-15 | Not run |  |  |  |  |
| UAT-16 | Not run |  |  |  |  |
| UAT-17 | Not run |  |  |  |  |
| UAT-18 | Not run |  |  |  |  |
| UAT-19 | Not run |  |  |  |  |
| UAT-20 | Not run |  |  |  |  |
| UAT-21 | Not run |  |  |  |  |
| UAT-22 | Not run |  |  |  |  |
| UAT-23 | Not run |  |  |  |  |
| UAT-24 | Not run |  |  |  |  |
| UAT-25 | Not run |  |  |  |  |
| UAT-26 | Not run |  |  |  |  |
| UAT-27 | Not run |  |  |  |  |
| UAT-28 | Not run |  |  |  |  |
| UAT-29 | Not run |  |  |  |  |
| UAT-30 | Not run |  |  |  |  |
| UAT-31 | Not run |  |  |  |  |
| UAT-32 | Not run |  |  |  |  |
| UAT-33 | Not run |  |  |  |  |
| UAT-34 | Not run |  |  |  |  |
| UAT-35 | Not run |  |  |  |  |
| UAT-36 | Not run |  |  |  |  |
| UAT-37 | Not run |  |  |  |  |
| UAT-38 | Not run |  |  |  |  |
| UAT-39 | Not run |  |  |  |  |
| UAT-40 | Not run |  |  |  |  |
| UAT-41 | Not run |  |  |  |  |
| UAT-42 | Not run |  |  |  |  |
| UAT-43 | Not run |  |  |  |  |
| UAT-44 | Not run |  |  |  |  |
| UAT-45 | Not run |  |  |  |  |
| UAT-46 | Not run |  |  |  |  |
| UAT-47 | Not run |  |  |  |  |
| UAT-48 | Not run |  |  |  |  |
| UAT-49 | Not run |  |  |  |  |
| UAT-50 | Not run |  |  |  |  |

For a defect, record the UAT ID, role/account email without password, Ticket number, exact input, numbered reproduction steps, expected result, actual result, HTTP status/error code when relevant, screenshot or sanitized request/response, and whether the issue reproduces after a clean reload. Use a new `RUN_ID` when retesting a case whose previous data would change its starting state.

UAT acceptance requires every mandatory UI case to be Pass, all controlled technical cases to be Pass or explicitly Blocked with separate automated evidence and an agreed owner, no unresolved defect that blocks the core Requester→Staff→Action→resolution path, no secret in evidence, and a final human review of the 1440×900, 820×1180, 390×844, and actual 200% zoom screens. Independent PR and peer review are later workflow steps and are not implied by a local UAT Pass.
