import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// API-01. `toEqual` on the whole body rather than a field-by-field check, so
// the test fails if the payload gains, loses, or renames anything — the
// endpoint's contract is the shape, not just the status code.
describe("GET /api/health", () => {
  it("returns 200 with status ok and the service name", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "TokTickIT API" });
  });
});
