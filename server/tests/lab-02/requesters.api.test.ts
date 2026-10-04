import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

afterAll(async () => { await getPrisma().$disconnect(); });

describe("Issue #17 authenticated requester migration", () => {
  it("removes the Development Requester selector API", async () => {
    expect((await request(app).get("/api/requesters")).status).toBe(404);
  });
});
