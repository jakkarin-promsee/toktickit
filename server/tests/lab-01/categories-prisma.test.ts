import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Prisma is replaced for this file only — Vitest gives each test file its own
// module registry, so categories.test.ts next door still queries the real
// database. Stubbing here is what makes the two things a live database cannot
// demonstrate observable: the exact query the route issues, and what happens
// when PostgreSQL is unreachable.
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("../../src/prisma.js", () => ({
  getPrisma: () => ({ category: { findMany } }),
}));

beforeEach(() => {
  findMany.mockReset();
  // The route logs the real error on the failure path. Silencing it keeps the
  // expected failure from printing a stack trace in the middle of a green run.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// API-03
describe("GET /api/categories — query contract", () => {
  it("asks Prisma for id and name only, ordered by id ascending", async () => {
    findMany.mockResolvedValue([{ id: 1, name: "Account and Access" }]);

    await request(app).get("/api/categories");

    // Asserting the query itself, because the response alone cannot prove it:
    // a freshly seeded table happens to come back in id order even without an
    // ORDER BY, so dropping `orderBy` would slip past a response-only check.
    // The same goes for `select` — this fails the moment either is removed.
    expect(findMany).toHaveBeenCalledWith({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
  });
});

// API-04
describe("GET /api/categories — database unavailable", () => {
  it("answers 503 with a message that leaks no internal detail", async () => {
    findMany.mockRejectedValue(
      new Error("Can't reach database server at localhost:5432")
    );

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Database unavailable" });

    // The host, port and driver name from the underlying error must not reach
    // the client; they belong in the server log only.
    expect(JSON.stringify(res.body)).not.toMatch(/localhost|5432|prisma/i);
  });
});
