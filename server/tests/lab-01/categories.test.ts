import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

// API-02. Unlike the health test, this one talks to the real PostgreSQL
// database, so `npx prisma migrate dev` and `npx prisma db seed` must have run
// first. That is the point: the acceptance criterion is that the endpoint
// reads categories *from PostgreSQL through Prisma*, and a stubbed database
// would prove nothing about the wiring this lab exists to demonstrate.
const SEEDED_NAMES = ["Account and Access", "Hardware", "Software", "Network"];

// The route opens a connection pool the first time it runs. Left open, the pool
// keeps Node's event loop alive and `vitest run` never exits after the last
// assertion.
afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.map((category: { name: string }) => category.name)).toEqual(
      SEEDED_NAMES
    );

    // The published contract (labsheet section 10.2) is exactly two fields.
    // Asserting the key set catches an accidental `createdAt` leak that a
    // name-only check would sail straight past.
    for (const category of res.body) {
      expect(Object.keys(category).sort()).toEqual(["id", "name"]);
      expect(typeof category.id).toBe("number");
      expect(typeof category.name).toBe("string");
    }

    // Guards against a response that comes back reversed or shuffled. Its
    // limit is worth being honest about: on a freshly seeded table PostgreSQL's
    // physical row order already matches id order, so this alone would still
    // pass with `orderBy` deleted from the query. What actually pins the
    // ordering down is the query-contract test in categories-prisma.test.ts.
    const ids = res.body.map((category: { id: number }) => category.id);
    expect(ids).toEqual([...ids].sort((a: number, b: number) => a - b));
  });
});
