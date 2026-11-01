# Lab 4 release and documentation TODO

Snapshot: 1 November 2026, on `feature/62-lab4-final-hardening`. This is the handoff checklist for the remaining Lab 4 work. The local implementation through Issue #62, the four engineering contracts, AI-use record, reviewer record, and 87 demonstration PNGs are prepared. The real feature branch passed both builds, 197 server tests, 107 client tests, 75 E2E tests, 9 visual tests, and the separate performance smoke. Those results do **not** substitute for a final `main` run. Do not claim manual UAT passed: the 50-case log in `docs/lab-04/uat.md` is blank, and this release does not require a new manual UAT run.

## Finish the GitHub workflow

- [ ] Push the Issue #62 feature branch, open own PR **#69** if GitHub assigns that number, obtain actual independent peer review, respond to substantive comments, and merge it into `lab4-staging` under the agreed workflow. Issue #62 currently has the local E2E selector fix in commit `37b1312`.
- [ ] Complete Issue #63 on the required `lab4-staging` release branch after #62 is reviewed and merged. Prepare the release PR from `lab4-staging` to `main` (**#70** only if GitHub assigns that number); obtain peer approval and let the user merge it. Record actual branch, PR, reviewer, merge, and commit links. Do not treat reserved numbers as existing PRs until verified. Route any release defect through a separate reviewed fix branch back into staging.
- [ ] Complete the reciprocal review of the partner's PRs **#76–#77** when they exist. Record the actual author, Issue, branch, review links, verdict, responses, and merge status.
- [ ] Move the Lab 4 issues to **Done** on the GitHub Project/Kanban board after completion; capture a readable final board link/screenshot. Confirm own Issues **#57–#63** and PRs **#64–#70** against GitHub rather than relying on planned numbering.
- [ ] Capture the final `main` repository URL and commit/branch graph. Verify the delivered README, `.gitignore`, and directory tree at that commit; capture readable links or images for PDF Part 1.

## Verify the final `main` state

- [ ] Before the release PR merges, run the complete build/test/visual/performance checks on the final `lab4-staging` release candidate and record its SHA and output. Recheck migration/seed, dashboard metric comparisons, screenshots, and documented limitations. Refresh the release candidate if review changes anything.
- [ ] At the exact final `main` commit, verify migration status, backed-up Lab 1–3 data preservation, seed repeatability, and the documented recovery path in `docs/lab-04/actions-migration.md`. Use an isolated scratch schema/database for destructive rehearsals; never reset a database containing real work.
- [ ] Run and record the complete final `main` commands and outputs: `npm --prefix server run build`, `npm --prefix client run build`, `npm run test:server`, `npm run test:client`, `npm run test:e2e`, `npm run test:visual`, and the opt-in `LAB4_PERF_SMOKE=1` dashboard performance test from `server/`. The normal server run intentionally skips only that opt-in smoke, which must pass separately. Record commit SHA, date, schema/environment, counts, failures/skips, and actual timings. If a test fails, fix and rerun before calling the release complete.
- [ ] Recheck the final `main` UI and selected evidence images against the delivered code: role dashboards, Action lifecycle, Ticket gate/history, Requester scope, Labs 1–3 regression, responsive matrix, keyboard/focus, console/link/placeholder sweep. The 87 PNGs are already available under `artifacts/lab-04/screenshots/`; recapture only if the final build differs. Clearly label synthetic data, intercepted `*-mocked.png` states, and the 200% **zoom-equivalent** viewport.

## Close document evidence gaps

- [ ] Update `docs/lab-04/reviewer.md` after both repositories reach `main`: fill actual details for own PRs #69–#70 and reviewed PRs #76–#77, refresh issue/merge status, and complete **Notable comments, responses, and resolutions** with direct links to posted comments, author replies, and the resulting decision or change. PR #64 already has an approval and four review comments, but no author replies were found when this checklist was prepared; add real responses if needed to satisfy the contract DoD. Do not invent discussion or approval.
- [ ] Close the two remaining unchecked items in `docs/lab-04/specification.md` §10: (1) four-document agreement **plus** documented peer comments/responses, and (7) actual peer review and approved staged integration. Complete its five independent-review challenge prompts only when the reviewer records the specific checks and responses. The other five §10 items are checked from local evidence; revalidate them if final `main` changes code.
- [ ] Add final `main` command/results evidence to `docs/lab-04/tests.md`; update its status/version history and any matrix row that changes. Keep fake-branch results, real feature-branch results, and final `main` results clearly distinguished. Keep the manual UAT log marked **Not run** unless a human actually executes cases.
- [ ] Update the status lines of `docs/lab-04/api-spec.md` and `docs/lab-04/ui-spec.md` from “final `main` verification pending” after that verification. `api-spec.md` and `tests.md` have no checkbox lists; the seven UI checklist items in `ui-spec.md` are already checked, subject to final build recheck.
- [ ] Check `docs/lab-04/ai-use.md` renders at its final `main` link. Its nine prompt selections and the author's reflection are complete; carry the prepared short reflection from the PDF draft into the final PDF.

## Assemble the one final submission PDF

Source outline: `plan/lab04-pdf-draft.md` (ignored by Git). It contains the drafted text, exact image choices, captions, and link placeholders. Make **one** concise, readable PDF with headings **Answer Part 1** through **Answer Part 9** in order; then verify every link, image, caption, and page at normal zoom. The 87 Lab 4 PNGs exist; the draft's image references resolved at the pre-release check. Do not shrink full-page images into unreadable thumbnails. Use final repository links or embed selected images.

| PDF part | Remaining final evidence |
| --- | --- |
| 1 — Git Use | Final `main` repo and commit graph; Project Done board; rendered reviewer record and actual review/response/approval links; README, `.gitignore`, directory tree. |
| 2 — Spec DD | Final `docs/lab-04/specification.md` link/rendered excerpt and verifiable Issue #57 contract-before-implementation commit/PR chronology. |
| 3 — Test DD | Final `docs/lab-04/tests.md` link/rendered excerpt, traceability, and complete test/build output tied to final `main`; disclose unrun manual UAT. |
| 4 — AI Use | Final `docs/lab-04/ai-use.md` link/rendered excerpt and the already drafted brief **My Reflection**. |
| 5 — Staff Dashboard | Select the drafted populated, Admin, drill-down, count-comparison, zero/failure, and responsive images; pair them with final-build status. |
| 6 — Actions Taken | Select the drafted list/create/assign/edit/transition/complete/cancel, Requester read-only, validation/failure, and responsive images. |
| 7 — Ticket Workflow | Select the drafted gate, Requester advisory, history, stale-conflict, and role-visibility images. |
| 8 — Requester Dashboard/Regression | Select the drafted owned dashboard/drill-down/empty/failure images and Labs 1–3 regression evidence. |
| 9 — UI/Accessibility | Final `docs/lab-04/ui-spec.md` link/rendered checklist; readable 1440×900, 820×1180, 390×844 matrix; focus/validation and zoom-equivalent evidence; final console/link/polish results. |

- [ ] Replace every remaining `<--- Need ... --->` placeholder in the PDF draft with verified final links or evidence; remove the working-draft banner in the submitted PDF.
- [ ] Export the final PDF, inspect all nine parts and selected images at normal zoom, confirm links resolve to the final `main` state, and submit the PDF by the course workflow.

## Already prepared; no repeat audit needed unless final code changes

- `docs/lab-04/ai-use.md`: complete content.
- `docs/lab-04/api-spec.md`: implemented contract; no checkboxes.
- `docs/lab-04/specification.md`: five local-evidence DoD items checked; two release/review items and five reviewer prompts remain above.
- `docs/lab-04/tests.md`: all executed matrix rows Pass; no checkboxes; local feature-branch evidence recorded separately from final `main`.
- `docs/lab-04/ui-spec.md`: all seven UI checklist items checked.
- `docs/lab-04/reviewer.md`: verified links for existing own PRs #64–#68 and partner PRs #71–#75; remaining records and discussion are listed above.
- `plan/lab04-pdf-draft.md`: all nine parts drafted and image set selected; final links, results, reflection, and PDF layout remain above.
