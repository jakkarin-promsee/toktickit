# Lab 1 — Test Plan and Evidence

Run everything: `cd server && npm test` · `cd client && npm test`

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

## Test inventory

| ID | Test File | Tool | Test Description | Status |
| --- | --- | --- | --- | --- |
| API-01 | `server/tests/lab-01/health.test.ts` | Supertest | `GET /api/health` returns 200 with `status = ok` and the service name | ✅ Implemented (Issue #2) |
| API-02 | `server/tests/lab-01/categories.test.ts` | Supertest | `GET /api/categories` returns the four seeded categories in id order | ⬜ Todo (Issue #4) |
| UI-01 | `client/tests/lab-01/App.test.tsx` | Vitest | The TokTickIT heading renders | ✅ Implemented (Issue #2) |
| UI-02 | `client/tests/lab-01/App.test.tsx` | Vitest | Success state shows Online and the seeded category list | ⬜ Todo (Issue #4) |
| UI-03 | `client/tests/lab-01/App.test.tsx` | Vitest | API failure shows Offline and a useful error message | ⬜ Todo (Issue #4) |

> **Status** describes the state of the test code. The proof that each one passes is in **Evidence** below.

---

## Evidence

### API-01 — `GET /api/health`

**Automated test**

```text
PS C:\Users\BTCOM\Desktop\toktickit\server> npm run test

> toktickit-server@1.0.0 test
> vitest run


 RUN  v2.1.9 C:/Users/BTCOM/Desktop/toktickit/server

 ↓ tests/lab-01/categories.test.ts (1) [skipped]
 ✓ tests/lab-01/health.test.ts (1)

 Test Files  1 passed | 1 skipped (2)
      Tests  1 passed | 1 todo (2)
   Start at  19:13:09
   Duration  904ms (transform 113ms, setup 0ms, collect 702ms, tests 27ms, environment 1ms, prepare 352ms)
```

**Manual check with `curl`**

```text
PS C:\Users\BTCOM\Desktop\toktickit> curl -i http://localhost:3000/api/health
HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 41
ETag: W/"29-Ncbz1ycfASMBs5j/gSdtsYEDEbo"
Date: Wed, 12 Aug 2026 12:05:45 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"status":"ok","service":"TokTickIT API"}
```

### API-02 — `GET /api/categories`

[TO FILL: paste the `npm test` output from `server/` once Issue #4 lands, plus a `curl -i http://localhost:3000/api/categories` showing the four categories in id order]

### UI-01 — Heading renders

[TO FILL: paste the `npm test` output from `client/`]

### UI-02 — Success state

[TO FILL: paste the `npm test` output from `client/` once Issue #4 lands]

### UI-03 — Error state

[TO FILL: paste the `npm test` output from `client/` once Issue #4 lands]

---

## Full run on `main`

Part 2 asks for evidence that **all tests pass in the `main` branch** — not on a feature branch. Run
both suites once after the release PR is merged, and paste both outputs here.

[TO FILL: `git switch main && git pull`, then paste the green `cd server && npm test` output]

[TO FILL: then paste the green `cd client && npm test` output]
