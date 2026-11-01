# Focused final verification — 2026-11-01

Scope: changed behavior only. This is a follow-up to `run.md`, not a full rerun of the 50-case Lab 4 UAT form. The original UAT statuses remain as recorded there.

## Commit sequence

1. `363f9b5` — snapshot of the issue 62 hardening baseline.
2. `ab353ac` — manual UAT form and pre-fix findings.
3. `1673c77` — Actions Taken stale-refresh repair and Requester submit guard, with focused tests and retest notes.
4. `3d6b114` — My Tickets search, URL state, pagination, and focused UI tests.
5. This evidence commit — focused final verification.

## Automated checks against final code

| Check | Result |
| --- | --- |
| `npm --prefix client test -- tests/lab-03/RequesterMyTicketsSearch.test.tsx tests/lab-03/RequesterCreateTicket.test.tsx tests/lab-03/RequesterTicketDetail.test.tsx tests/lab-04/ActionsTaken.test.tsx` | Pass: 4 files, 30 tests |
| `npm --prefix client run build` | Pass: TypeScript and Vite production build |

The focused tests cover default My Tickets loading, search debounce and URL restoration, preserving Dashboard filters, pagination and clear behavior, duplicate Create Ticket submission, and Actions Taken stale-refresh selection. They do not claim a complete manual UAT pass.

## Live Requester check

In the local app at `http://localhost:5173/tickets`, signed in as Anan Chai (Requester):

| Step | Observed result |
| --- | --- |
| Open My Tickets without query parameters | Seven Tickets loaded, `Showing 1–7 of 7`; no Clear filters button appeared. |
| Search `TKT-20261031-000010` | URL became `?search=TKT-20261031-000010`; only that Ticket appeared, `Showing 1–1 of 1`. |
| Search `NO-SUCH-TICKET-999` | URL updated and `No Tickets match this filter.` appeared. |
| Click Clear filters | Search and URL query cleared; seven Tickets returned. |

Live pagination across multiple pages was unavailable because this Requester had seven Tickets. The UI test checks page 2 and reset to page 1 after a new search with a mocked 11-Ticket response.

## Scope and remaining UAT status

UAT-08 remains Partial because its Network throttling step was not repeated; its My Tickets search gap is now fixed and checked above. UAT-31 remains Partial because the exact Narin/Kanda two-role sequence was not repeated, although its focused two-tab Narin retest and regression passed. The other Partial cases in `run.md` were not promoted by these checks. The user chose to defer the remaining broad Lab 4 UAT work to Lab 5.
