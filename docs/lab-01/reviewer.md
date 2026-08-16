# Lab 1 — Peer Review Record

| Role | Full Name | Student ID | GitHub username |
| --- | --- | --- | --- |
| **Author** | Jakkarin Promsee | 67070501009 | [@jakkarin-promsee](https://github.com/jakkarin-promsee) |
| **Peer reviewer** | Achirawish Prasom | 67070501076 | [@UsernameJillzaza](https://github.com/UsernameJillzaza) |

Every review is quoted verbatim. Text in a `>` quote block is the **reviewer's own words**;
plain text under it is the **author's response**.

- **[Part A](#part-a--reviews-i-received)** — my partner reviewed my PRs.
- **[Part B](#part-b--reviews-i-gave)** — I reviewed my partner's PRs.

---

## PR index

### PRs I authored — reviewed by my partner

| PR | Issue | Title | Branch | Verdict |
| --- | --- | --- | --- | --- |
| [#5](https://github.com/jakkarin-promsee/toktickit/pull/5) | #1 | Set up the TokTickIT project foundation | `feature/1-project-foundation` | ✅ Approved |
| [TO FILL: link] | #2 | Implement the API health check | `feature/2-health-check` | [TO FILL] |
| [TO FILL: link] | #3 | Create and seed IT request categories | `feature/3-category-seed` | [TO FILL] |
| [TO FILL: link] | #4 | Display the IT request category list | `feature/4-category-list` | [TO FILL] |

### PRs I reviewed — authored by my partner

| PR | Issue | Title | Branch | Verdict I gave |
| --- | --- | --- | --- | --- |
| [TO FILL: link to partner's repo PR] | #1 | Set up the TokTickIT project foundation | `feature/1-project-foundation` | ✅ Approved |
| [TO FILL: link] | #2 | Implement the API health check | `feature/2-health-check` | [TO FILL] |
| [TO FILL: link] | #3 | Create and seed IT request categories | `feature/3-category-seed` | [TO FILL] |
| [TO FILL: link] | #4 | Display the IT request category list | `feature/4-category-list` | [TO FILL] |

---

## Part A — Reviews I received

### A1 · PR #5 — Set up the TokTickIT project foundation

**Branch:** `feature/1-project-foundation` → `lab1-staging` · **Reviewer:** @UsernameJillzaza · **Verdict:** ✅ Approved

**Reviewer's comment:**

> **Review — feature/1-project-foundation**
>
> Went through this one, looks solid overall. Ran npm test + npm run build on both sides and pulled up the client, checked it against the AC list:
>
> - [x] client starts, Bootstrap's actually there not just installed
> - [x] server starts, hits /api/health → yep 501 on purpose, saw your note about it being the red step for #2, makes sense
> - [x] prisma initialized, schema/seed both just have the TODO stubs for #3, good — not doing more than the issue asks
> - [x] .gitignore / .env.example look right, no real .env anywhere
> - [x] README setup actually works following it top to bottom
>
> Couple small things, nothing blocking:
>
> - categories.test.ts — the it.todo(...) has a full async body with an assertion in it, but todo tests don't run so that body's dead code right now. Probably fine to just leave it as it.todo("returns the four seeded categories in id order") with no fn until #4, one less thing sitting there unused.
> - README already has the psql PATH note in step 2, nice, saves someone getting stuck there.
> - good that this landed as 13 separate commits grouped docs → client → server instead of one big blob, way easier to skim than mine was.
> - Nice catch fixing the tsconfig noEmit + the dist/src/index.js start path before I even had to say anything, saved me a comment.
>
> Approving — good foundation, ready for staging.

**How I responded:**

Read carefully, check the thing on the comment said, then merge into lab1-staging.

[TO FILL: the one actionable item was the dead body inside `it.todo(...)` in `categories.test.ts` — say whether you removed it, and in which commit / which issue you handled it]

### A2 · PR — Implement the API health check

**Branch:** `feature/2-health-check` → `lab1-staging` · **Reviewer:** @UsernameJillzaza · **Verdict:** [TO FILL]

**Reviewer's comment:**

> [TO FILL: paste your partner's review comment verbatim, one `>` per line]

**How I responded:**

[TO FILL: what you changed, and the commit hash — or why you disagreed]

### A3 · PR — Create and seed IT request categories

**Branch:** `feature/3-category-seed` → `lab1-staging` · **Reviewer:** @UsernameJillzaza · **Verdict:** [TO FILL]

**Reviewer's comment:**

> [TO FILL]

**How I responded:**

[TO FILL]

### A4 · PR — Display the IT request category list

**Branch:** `feature/4-category-list` → `lab1-staging` · **Reviewer:** @UsernameJillzaza · **Verdict:** [TO FILL]

**Reviewer's comment:**

> [TO FILL]

**How I responded:**

[TO FILL]

---

## Part B — Reviews I gave

### B1 · PR — Set up the TokTickIT project foundation

**Author:** @UsernameJillzaza · **Branch:** `feature/1-project-foundation` → `lab1-staging` · **Verdict I gave:** ✅ Approved, with non-blocking comments

**My summary review:**

> **Review — feature/1-project-foundation**
>
> **Verified Issue #1 criteria**
>
> - [x] React + TypeScript + Vite frontend starts successfully
> - [x] Bootstrap is installed and visible in the frontend
> - [x] Node.js + Express + TypeScript backend starts successfully
> - [x] PostgreSQL is reachable and Prisma is initialized
> - [x] Vitest and Supertest commands are configured
> - [x] `.gitignore` and `.env.example` exist; secrets and `node_modules` are not committed
> - [x] Initial README setup instructions are present
>
> **How I verified this**
>
> I cloned the branch into a clean folder, ran the README setup end to end
> (install → createdb → .env → migrate), then started both processes and hit
> `/api/health` and the UI. I did not just read the diff.
>
> **What's solid**
>
> - `.gitignore` patterns are depth-agnostic, so one entry protects both workspaces,
>   and `git log --all -- "*env*"` confirms no real `.env` has ever been committed,
>   the history is clean, not just the working tree.
> - README is followable start to finish with zero guessing. Section order matches
>   the real dependency order, which is why it works.
> - Repo layout matches the required structure in the lab sheet exactly.
>
> **Non-blocking, for the next PR**
>
> this branch landed as a single commit covering the Vite scaffold, the Express server,
> Prisma init, and the docs. It works, but it collapses four independent decisions into
> one point in history.
>
> Happy to re-review the moment they're pushed; the foundation itself is right.

**My inline comment on `.gitignore`:**

> `node_modules/` is written without a leading slash, so it matches at any depth, this one
> line covers both `client/` and `server/` without needing separate entries.
>
> I checked the history rather than just the working tree:
>
> ```text
> git log --all --diff-filter=A --name-only --pretty=format: -- "*env*"
> ```
>
> The only env file ever added is `server/.env.example`. No real `.env` has ever
> entered history, so there's nothing to scrub. And it stays that way going forward
> `.env` and `.env.*` also have no leading slash, so they apply in every subfolder,
> and `!.env.example` re-includes the template.

**My inline comment on `README.md`:**

> I tested this the way a new person would: fresh `git clone` into an empty folder,
> then followed every step top to bottom without filling in anything from memory.
> Both processes came up, API on :3000, Vite on :5173, and the page rendered.
>
> Two things worth tightening before this lands:
>
> 1. **No seed step.** Step 4 stops at `npx prisma migrate dev`, but
>    `GET /api/categories` is specified to return the four seeded categories. That
>    only works automatically if `package.json` declares
>    `"prisma": { "seed": "..." }`, otherwise a fresh clone gets an empty table and
>    an empty list in the UI, with no error to explain why. Is the seed wired into
>    package.json? If not, could we add an explicit `npx prisma db seed` as step 5?
>
> 2. **`psql` on PATH.** Step 2 assumes it's available. On a default Windows
>    PostgreSQL install it isn't unless "Command Line Tools" was ticked. One extra
>    clause "or create it in pgAdmin" saves the next person from getting stuck
>    two steps into setup.
>
> Everything else held up. Section order matches the actual dependency order, which
> is why it works without guessing.

**How my partner responded:**

Agreed with me, then moved to merge.

[TO FILL: did they actually add the `npx prisma db seed` step and the pgAdmin note? Say which commit, so the loop is visibly closed]

### B2 · PR — Implement the API health check

**Author:** @UsernameJillzaza · **Branch:** `feature/2-health-check` → `lab1-staging` · **Verdict I gave:** [TO FILL]

**My review:**

> [TO FILL]

**How my partner responded:**

[TO FILL]

### B3 · PR — Create and seed IT request categories

**Author:** @UsernameJillzaza · **Branch:** `feature/3-category-seed` → `lab1-staging` · **Verdict I gave:** [TO FILL]

**My review:**

> [TO FILL]

**How my partner responded:**

[TO FILL]

### B4 · PR — Display the IT request category list

**Author:** @UsernameJillzaza · **Branch:** `feature/4-category-list` → `lab1-staging` · **Verdict I gave:** [TO FILL]

**My review:**

> [TO FILL]

**How my partner responded:**

[TO FILL]
