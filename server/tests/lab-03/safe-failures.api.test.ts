import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Every Prisma call fails with a message full of sensitive markers. The API must
// answer with its safe envelope and never echo any of them.
const leakMarkers = ["SELECT", "secret_table", "C:\\srv\\toktickit", "hunter2", "$argon2id$", "postgresql://"];

vi.mock("../../src/prisma.js", () => {
  const fail = () => {
    throw new Error("SELECT * FROM secret_table at C:\\srv\\toktickit password=hunter2 $argon2id$ postgresql://toktickit:toktickit@db");
  };
  const delegate: unknown = new Proxy(fail, { get: () => delegate, apply: fail });
  return { getPrisma: () => delegate };
});

const { app } = await import("../../src/app.js");
const origin = "http://localhost:5173";
const fakeSession = `toktickit_session=${"a".repeat(64)}`;

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterAll(() => {
  vi.restoreAllMocks();
});

function expectSafe(response: { status: number; body: unknown; text: string }, label: string) {
  expect([500, 503], label).toContain(response.status);
  const body = response.body as { error?: { code?: unknown; message?: unknown } };
  expect(typeof body.error?.code, label).toBe("string");
  expect(typeof body.error?.message, label).toBe("string");
  for (const marker of leakMarkers) expect(response.text, `${label} leaks ${marker}`).not.toContain(marker);
  expect(response.text, label).not.toMatch(/\bat \w+ \(|node_modules|stack/i);
}

describe("FAIL-01 Issue #38 safe dependency failures", () => {
  it("returns a safe envelope for login when the database is unavailable", async () => {
    const response = await request(app).post("/api/auth/login").set("Origin", origin).send({ email: "anan@example.test", password: "Any!Passw0rd-38" });
    expectSafe(response, "POST /api/auth/login");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns a safe envelope for every authenticated endpoint family when the session lookup fails", async () => {
    const ticketId = "31000000-0000-4000-8000-000000000001";
    const calls: [string, () => request.Test][] = [
      ["GET /api/auth/me", () => request(app).get("/api/auth/me")],
      ["GET /api/tickets", () => request(app).get("/api/tickets")],
      ["GET /api/tickets/:id", () => request(app).get(`/api/tickets/${ticketId}`)],
      ["GET /api/tickets/:id/comments", () => request(app).get(`/api/tickets/${ticketId}/comments`)],
      ["GET /api/staff/tickets", () => request(app).get("/api/staff/tickets")],
      ["GET /api/staff/tickets/:id", () => request(app).get(`/api/staff/tickets/${ticketId}`)],
      ["GET /api/staff/tickets/:id/internal-notes", () => request(app).get(`/api/staff/tickets/${ticketId}/internal-notes`)],
      ["GET /api/admin/users", () => request(app).get("/api/admin/users")],
      ["POST /api/admin/users", () => request(app).post("/api/admin/users").set("Origin", origin).send({})],
    ];
    for (const [label, call] of calls) {
      expectSafe(await call().set("Cookie", fakeSession), label);
    }
  });

  it("returns a safe envelope for public reference data", async () => {
    const response = await request(app).get("/api/categories");
    expect([500, 503]).toContain(response.status);
    for (const marker of leakMarkers) expect(response.text).not.toContain(marker);
  });
});
