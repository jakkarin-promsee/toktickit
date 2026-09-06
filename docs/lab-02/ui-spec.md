# Lab 2 UI Specification

Status: Approved contract; implementation and visual verification complete through Issue #17

This document is the visual and interaction contract for Requester Selection, Create Ticket, My Tickets,
Ticket Detail, and Attachments. It refines FR-01–FR-17 and AC-01–AC-17.

## 1. Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `--green-700` | `#006B3C` | Header, primary button, strong emphasis |
| `--green-600` | `#0B7A46` | Active navigation, links, focus, hover |
| `--green-050` | `#EAF6EF` | Selected/success/subtle emphasis |
| `--page` | `#F5F7F6` | Page background |
| `--surface` | `#FFFFFF` | Cards, forms, tables |
| `--text` | `#17352A` | Main charcoal-green text |
| `--muted` | `#5C6F67` | Supporting text |
| `--border` | `#C8D5CF` | Neutral borders |
| `--readonly` | `#F1F3EE` | Read-only field background |
| `--danger` | `#9B1C1C` | Errors/destructive action |
| `--warning` | `#9A6700` | Warnings and partial success |

Use the existing system sans-serif stack, a 16 px body size, 1.5 line height, and a modular spacing scale
of 4, 8, 12, 16, 24, 32, and 48 px. Content is centered at a maximum width of 1200 px. Cards use a 1 px
border, 8 px radius, and restrained shadow. Color never carries meaning without text or an icon plus an
accessible name.

## 2. Application shell and navigation

- Header shows `TokTickIT`, My Tickets, Create Ticket, current Requester name, and Change Requester.
- The current route has both visual active styling and `aria-current="page"`.
- Before a valid Requester exists, only the selection screen is available.
- Change Requester returns to selection, and confirmation is required if an unsaved form is dirty.
- Desktop navigation is inline. Below 768 px it collapses behind a text-labeled Menu button with
  `aria-expanded`; identity and Change Requester remain reachable by keyboard.
- Page title uses one `h1`; sections follow heading order without skipped levels.

## 3. Reusable component rules

### Form controls

- Labels appear above controls. Required labels append a visible red `*` and screen-reader text
  `(required)`; HTML `required`/`aria-required` is also set.
- Inputs/selects are 44 px minimum height. Description is at least 160 px and vertically resizable.
- Editable controls are white with neutral border. Read-only values use `--readonly`, `aria-readonly` where
  applicable, and cannot receive user input.
- Invalid controls use `aria-invalid="true"` and `aria-describedby` pointing to the immediately following
  dark-red message. A top summary may supplement but never replace field messages.
- Focus uses a visible 3 px `--green-600` outline with 2 px offset.
- Disabled controls have reduced contrast plus disabled semantics and cannot activate.

### Buttons and feedback

- Primary: solid `--green-700`; secondary: white with green border; tertiary: text link; destructive:
  solid/outlined `--danger` according to risk.
- Buttons contain visible action text. Icon-only controls require an accessible label and tooltip.
- Busy buttons retain width, show a spinner plus text such as `Creating ticket…`, set `aria-busy`, and are
  disabled.
- Success, warning, and error callouts use `role="status"` or `role="alert"` as appropriate and include
  readable text.
- Skeleton/spinner loading states name what is loading. Retry actions are available for recoverable errors.

### Badges, tables, and files

- Status NEW: pale-green background and `New`; Requested Priority LOW/MEDIUM/HIGH: neutral/amber/red tint
  with full text. IT Priority UNASSIGNED is muted. Badge meaning does not depend on color.
- Desktop data tables use real table semantics, visible headers, sortable buttons with `aria-sort`, and a
  whole-row-independent `View ticket` link.
- Long filenames wrap anywhere; size and type stay visible. Active, uploading, invalid, removed, and
  unavailable states use text labels.

## 4. Development Requester Selection

The centered card contains:

1. TokTickIT title and heading `Select a Development Requester`.
2. Exact-purpose guidance: `Select a Development Requester to test requester-specific ticket behavior.
   This is not a login screen. Authentication and role-based access will be introduced in Lab 3.`
3. Labeled Requester dropdown populated from the API.
4. Primary Continue button, disabled until a valid active option is selected.

States:

- **Loading:** disabled select/button and `Loading active Requesters…`.
- **Ready:** prompt option plus active Requesters sorted by display name.
- **Empty:** `No active Development Requesters are available` and Retry; Continue absent/disabled.
- **Failure:** safe alert `We couldn't load Requesters` and Retry; no technical details.
- **Selected:** Continue stores context and opens My Tickets.

## 5. Create Ticket

### Structure

- Header row: page title and link back to My Tickets.
- `Ticket information` card:
  - read-only Ticket Number (`Generated after submission`), Ticket Date (`Assigned on submission`), Requester,
    Current Status (`New`), and IT Priority (`Unassigned`);
  - required Category, Related System, Ticket Summary, Requested Priority, and Description.
- `Attachments` card below the fields, with file picker, accepted formats/5 MB/five-active help text,
  selected-file rows, validation messages, and Remove-from-selection action.
- Footer actions: primary Create Ticket and secondary Clear. Clear requires confirmation when dirty.

At desktop, metadata is a compact two-column grid and classification fields share a row; Summary and
Description span full width. Tablet uses two columns where labels fit. Mobile stacks every field and uses
full-width actions.

### States

- **Reference loading:** classification controls disabled and named loading feedback shown.
- **Initial:** no validation messages; generated fields show placeholders.
- **Validation failure:** focus moves to the first invalid field; each invalid field has its own message.
- **Submitting:** all editable controls and navigation that could duplicate submission are disabled.
- **Success:** a focusable success panel shows the official Ticket Number, `View ticket`, `Go to My Tickets`,
  and `Create another`.
- **API failure:** safe alert with Retry; entered fields and selected files remain.
- **Partial attachment success:** amber panel names successful/failed counts and offers retry for failed files;
  Ticket Number and link remain visible.

## 6. My Tickets

### Controls and desktop layout

- Page heading, Create Ticket primary action, search by Ticket Number/Summary, Category/System/Status/
  Requested Priority filters, sort field/direction, and Clear filters.
- Search is debounced 300 ms; search, filters, sort, page, and page size are reflected in URL query
  parameters so refresh/direct navigation restores the list state.
- Desktop table columns: Ticket Number, Summary, Category, Requested Priority, Status, Last Updated, and
  View. Summary may wrap to two lines.
- Pagination below the list shows `Showing X–Y of Z`, Previous/Next, page buttons, and page-size select.

### Mobile layout

Below 768 px controls stack and each result is a card containing the same identifying data. A visible
`View ticket` link is last. Pagination wraps but does not horizontally scroll.

States:

- **Loading:** controls remain visible but results use labeled skeleton rows/cards.
- **Empty:** no tickets for this Requester, explanation, and Create Ticket action.
- **No results:** active criteria summary, `No tickets match`, and Clear filters.
- **Failure:** safe alert and Retry while current criteria remain.
- **Results:** stable list; changing search/filter/sort/page size resets page to 1.

## 7. Requester Ticket Detail

- Breadcrumb/back link to My Tickets, page title containing Ticket Number, and status/priority badges.
- `Ticket information` card displays Ticket Date, Requester, Category, Related System, Summary, Requested
  Priority, IT Priority, Current Status, Description, and timestamps as read-only definition-list fields.
- `Attachments` is a separate card with Add attachment; no edit controls exist for Ticket fields.
- Loading uses a labeled detail skeleton. Safe missing/denied uses the same `Ticket not found` screen with
  My Tickets link. Unexpected failure provides Retry.
- No comments, Internal Notes, Actions Taken, assignment, IT Priority action, or status action is rendered.

Desktop/tablet may use two-column metadata with full-width Summary/Description. Mobile is one column.

## 8. Attachment interactions

- Picker accepts JPG/JPEG, PNG, WEBP, and PDF and repeats the 5 MB/five-active rules in help text.
- Client validation happens on selection; invalid rows remain visible with reason and are not uploaded.
- Uploading rows show progress/busy text and cannot be removed simultaneously.
- Active rows show original filename, type, formatted size, upload date, Download/Open, and Remove.
- Remove opens an accessible dialog naming the file, warning that bytes become unavailable, and requiring
  a 10–250 character reason. Cancel receives initial focus; confirm is destructive and disabled until valid.
- Removed rows remain in a collapsed `Removed attachments` section with filename, removal date, remover,
  and reason. Download/preview controls are absent and state text says `Removed`.
- Upload/remove failure leaves the row and user input intact, announces a safe error, and offers Retry.

## 9. Responsive and accessibility contract

| Viewport | Required layout |
| --- | --- |
| Desktop `>= 992px` | Centered max-width content; multi-column forms; Ticket table |
| Tablet `768–991px` | Two-column forms where practical; wrapping controls; Ticket table without page overflow |
| Mobile `< 768px` | Single-column forms; Ticket cards; touch targets at least 44 px |

At all sizes there must be no page-level horizontal scrolling, clipped labels, overlapping validation,
hidden actions, unreadable filenames, or color-only states. Zoom to 200% must preserve content and
operation. Dialogs trap focus, close with Escape, restore trigger focus, and have labeled title/description.
Dynamic status is announced without unexpectedly moving focus, except validation moves focus to the first
invalid field.

## 10. Visual evidence checklist

- [x] Primary/secondary greens, quiet page, white cards, readable charcoal text match tokens.
- [x] Editable, read-only, invalid, focused, disabled, and busy controls are visibly distinct.
- [x] Required markers and immediate field messages are present.
- [x] Navigation identity and active-page indication work at all widths.
- [x] Create initial, validation, submitting, success, API failure, and invalid-file states are captured.
- [x] My Tickets results, empty, no-results, filtering, sorting, and pagination are captured.
- [x] Detail active/removed Attachment states and safe denied state are captured.
- [x] Desktop (1440×900), tablet (820×1180), and mobile (390×844) have no clipping, overlap, hidden
      buttons, or horizontal page overflow.

Screenshots belong under `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/`.
