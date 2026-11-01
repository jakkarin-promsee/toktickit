# Lab 4 closeout TODO

Snapshot: 1 November 2026. Sprint 4 is merged into `main` at `3d049a0d9f8c212eb0eb3c2dd4a48b687f52b5bd` through approved release PR #70. This document is the remaining-work handoff; do not repeat the earlier release audit unless code changes.

## Completed and verified

- [x] Own Issues #57–#63 are closed; feature PRs #64–#69 entered `lab4-staging` in order; release PR #70 merged to `main` with actual peer approval. Partner reviews #71–#76 have verified PR/review links in `docs/lab-04/reviewer.md`.
- [x] The owner-supplied before/after GitHub Project images are copied byte-for-byte from Downloads into `artifacts/lab-04/release-evidence/kanban-before-backlog.png` and `kanban-after-done.png`. The after image shows all seven issues in Done. The Project URL is <https://github.com/users/jakkarin-promsee/projects/7/views/1>.
- [x] Final `main` builds passed. Server tests: 197 passed and the separate opt-in performance test skipped by design; client: 107 passed; E2E: 75 passed; visual: 9 passed; separate dashboard performance smoke: 1 passed. Results and test-schema limits are recorded in `docs/lab-04/tests.md`. Readable images rendered from the captured terminal stdout and a Git merge-history image are in `artifacts/lab-04/release-evidence/` and indexed by `artifacts/lab-04/README.md`.
- [x] `docs/lab-04/api-spec.md`, `specification.md`, `tests.md`, `ui-spec.md`, and `reviewer.md` reflect the final `main` state and distinguish verified evidence from pending GitHub activity. All seven UI specification checklist items are checked. `docs/lab-04/ai-use.md` is complete. The 50-case human UAT log remains accurately marked Not run; this closeout does not require a new manual UAT run.
- [x] `plan/lab04-pdf-draft.md` contains the nine required parts and final-main links/results. A 14-page review PDF is at `plan/lab4-closeout-20261101/lab04-submission-preview.pdf` (ignored local working file). It is explicitly marked preview while the items below are outstanding.

## Remaining actions for the owner and peer

- [ ] Complete the peer's PR #77 when it exists, obtain an actual independent review, and merge it under the agreed workflow. As of this snapshot, PR #77 was not found and the partner's Issue #69 was open. Update the #77 row in `docs/lab-04/reviewer.md` using the real PR, approval, discussion, and merge links. Do not infer approval from a prepared review file.
- [ ] Post real author responses to substantive review comments on own PRs if the course's discussion requirement is being satisfied through GitHub. None were verified on PRs #64–#70 at this snapshot. Then add the exact comment/response/resolution links to `docs/lab-04/reviewer.md` and check the first Definition of Done item in `docs/lab-04/specification.md` only when the record actually supports it. Leave the five independent-review challenge prompts unchecked unless the reviewer performs and records those checks.
- [ ] Capture one real IDE Explorer screenshot showing the final repository directory structure for PDF Part 1 if the instructor expects the assignment's literal “in your IDE” image. The repository tree link is already in the preview; it does not replace that specific screenshot. Place the image under `artifacts/lab-04/release-evidence/` and add it to the evidence index.
- [ ] If the instructor requires literal terminal-window screenshots, capture server, client, and E2E result windows. The existing images are faithful **rendered excerpts of captured stdout**, not terminal-window captures; they already show the verified counts and should be sufficient if output evidence is accepted.
- [ ] If demonstrating against the local `server/.env` `public` database, back up its existing data/attachments and apply the missing Lab 3 and Lab 4 migrations safely. The isolated `lab2_test` and `lab3_e2e` schemas used by the passing tests are already migrated. Do not reset `public` merely to complete the documentation.

## Final submission after the external evidence exists

- [ ] Refresh the PDF preview with actual PR #77 and author-response details; add the IDE image if captured. Check each of Answer Part 1–9, all links, image legibility, and captions at normal zoom. Remove the preview/pending banner only when the claims are true. Export the one final PDF and submit it using the course workflow.
- [ ] Push the `docs/63-lab4-release-closeout` documentation branch, open its PR, obtain review, and merge only when the owner chooses. The agent must not push or merge. GitHub `main` links embedded in the docs/PDF will resolve to the new closeout assets after that merge.
