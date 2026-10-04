import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const origin = "http://localhost:5173";
const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD!;
const prisma = getPrisma();

async function signedInAgent(email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").set("Origin", origin).send({ email, password: initialPassword });
  expect(response.status).toBe(200);
  return { agent, csrfToken: response.body.data.csrfToken };
}

beforeAll(async () => {
  await prisma.user.updateMany({ where: { email: { in: ["anan@example.test", "mali@example.test", "narin.staff@example.test", "araya.admin@example.test"] } }, data: { mustChangePassword: false } });
});

afterAll(async () => {
  await prisma.user.updateMany({ where: { email: { in: ["anan@example.test", "mali@example.test", "narin.staff@example.test", "araya.admin@example.test"] } }, data: { mustChangePassword: true } });
  await prisma.$disconnect();
});

describe("SEC-02 Issue #33 authorization boundaries", () => {
  it("requires a live session and blocks a password-change-required requester from Ticket APIs", async () => {
    expect((await request(app).get("/api/tickets")).status).toBe(401);
    await prisma.user.update({ where: { email: "anan@example.test" }, data: { mustChangePassword: true } });
    const { agent } = await signedInAgent("anan@example.test");
    const response = await agent.get("/api/tickets");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
    await prisma.user.update({ where: { email: "anan@example.test" }, data: { mustChangePassword: false } });
  });

  it("uses the session requester rather than forged requester headers and hides cross-owner Tickets", async () => {
    const { agent } = await signedInAgent("anan@example.test");
    const list = await agent.get("/api/tickets").set("X-Requester-Id", "2");
    expect(list.status).toBe(200);
    expect(list.body.data.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toContain("TKT-20261004-310001");
    expect(list.body.data.map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).not.toContain("TKT-20261004-310002");
    const otherOwner = await agent.get("/api/tickets/31000000-0000-4000-8000-000000000002").set("X-Requester-Id", "2");
    const missing = await agent.get("/api/tickets/00000000-0000-4000-8000-000000000000");
    expect(otherOwner.status).toBe(404);
    expect(otherOwner.body).toEqual(missing.body);
    expect(JSON.stringify(otherOwner.body)).not.toContain("Wi-Fi");
  });

  it("requires CSRF for requester mutations and protects cross-owner Attachments", async () => {
    const { agent, csrfToken } = await signedInAgent("anan@example.test");
    const noCsrf = await agent.post("/api/tickets").send({ categoryId: 1, relatedSystemId: 1, summary: "Session-bound identity test", requestedPriority: "LOW", description: "This ticket is created only when CSRF is present." });
    expect(noCsrf.status).toBe(403);
    const create = await agent.post("/api/tickets").set("Origin", origin).set("X-CSRF-Token", csrfToken).set("X-Requester-Id", "2").send({ categoryId: 1, relatedSystemId: 1, summary: "Session-bound identity test", requestedPriority: "LOW", description: "This ticket belongs to the signed-in requester." });
    expect(create.status).toBe(201);
    expect(create.body.data.requester.email).toBeUndefined();
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: create.body.data.id } });
    expect(ticket.submittedByUserId).toBe(1);
    const attachment = await prisma.attachment.create({ data: { ticketId: "31000000-0000-4000-8000-000000000002", originalName: "private.txt", storageName: "issue-33-private.txt", mimeType: "text/plain", sizeBytes: 7, sha256: "a".repeat(64), uploadedByUserId: 2 } });
    const otherOwner = await agent.get(`/api/attachments/${attachment.id}/download`);
    const missing = await agent.get("/api/attachments/00000000-0000-4000-8000-000000000000/download");
    expect(otherOwner.status).toBe(404);
    expect(otherOwner.body).toEqual(missing.body);
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  it("enforces role boundaries independently of navigation", async () => {
    const requester = await signedInAgent("anan@example.test");
    const staff = await signedInAgent("narin.staff@example.test");
    const admin = await signedInAgent("araya.admin@example.test");
    expect((await requester.agent.get("/api/staff/tickets")).status).toBe(403);
    expect((await requester.agent.get("/api/admin/users")).status).toBe(403);
    expect((await staff.agent.get("/api/tickets")).status).toBe(403);
    expect((await staff.agent.get("/api/admin/users")).status).toBe(403);
    expect((await admin.agent.get("/api/tickets")).status).toBe(403);
    expect((await admin.agent.get("/api/staff/assignees")).status).toBe(403);
  });
});

const staffTicketId = "31000000-0000-4000-8000-000000000002";

describe("SEC-01 Issue #38 CSRF and Origin checks", () => {
  it("rejects missing, wrong, cross-session, and disallowed-Origin writes and allows safe GETs without a token", async () => {
    const first = await signedInAgent("anan@example.test");
    const second = await signedInAgent("anan@example.test");
    const comment = { content: "Issue 38 CSRF probe comment." };
    const path = "/api/tickets/31000000-0000-4000-8000-000000000001/comments";
    const before = await prisma.publicComment.count();
    const attempts = [
      first.agent.post(path).set("Origin", origin).send(comment),
      first.agent.post(path).set("Origin", origin).set("X-CSRF-Token", "b".repeat(64)).send(comment),
      first.agent.post(path).set("Origin", origin).set("X-CSRF-Token", second.csrfToken).send(comment),
      first.agent.post(path).set("Origin", "http://evil.example").set("X-CSRF-Token", first.csrfToken).send(comment),
      first.agent.post(path).set("X-CSRF-Token", first.csrfToken).send(comment),
    ];
    for (const response of await Promise.all(attempts)) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
    }
    expect(await prisma.publicComment.count()).toBe(before);
    expect((await first.agent.get(path)).status).toBe(200);
  });
});

describe("SEC-02 Issue #38 direct API role matrix", () => {
  it("allows only the matrix-permitted role for each protected operation", async () => {
    const sessions = {
      REQUESTER: await signedInAgent("anan@example.test"),
      IT_STAFF: await signedInAgent("narin.staff@example.test"),
      ADMINISTRATOR: await signedInAgent("araya.admin@example.test"),
    };
    type Role = keyof typeof sessions;
    const headers = (role: Role) => ({ Origin: origin, "X-CSRF-Token": sessions[role].csrfToken });
    const matrix: { name: string; allowed: Role[]; call: (role: Role) => Promise<{ status: number; body: unknown }> }[] = [
      { name: "GET my tickets", allowed: ["REQUESTER"], call: (role) => sessions[role].agent.get("/api/tickets") },
      { name: "GET staff queue", allowed: ["IT_STAFF", "ADMINISTRATOR"], call: (role) => sessions[role].agent.get("/api/staff/tickets") },
      { name: "GET staff detail", allowed: ["IT_STAFF", "ADMINISTRATOR"], call: (role) => sessions[role].agent.get(`/api/staff/tickets/${staffTicketId}`) },
      { name: "GET internal notes", allowed: ["IT_STAFF", "ADMINISTRATOR"], call: (role) => sessions[role].agent.get(`/api/staff/tickets/${staffTicketId}/internal-notes`) },
      { name: "GET assignees", allowed: ["IT_STAFF"], call: (role) => sessions[role].agent.get("/api/staff/assignees") },
      { name: "PATCH IT priority (malformed body)", allowed: ["IT_STAFF"], call: (role) => sessions[role].agent.patch(`/api/staff/tickets/${staffTicketId}/it-priority`).set(headers(role)).send({}) },
      { name: "POST internal note (empty)", allowed: ["IT_STAFF"], call: (role) => sessions[role].agent.post(`/api/staff/tickets/${staffTicketId}/internal-notes`).set(headers(role)).send({ content: " " }) },
      { name: "GET admin users", allowed: ["ADMINISTRATOR"], call: (role) => sessions[role].agent.get("/api/admin/users") },
      { name: "POST admin user (empty)", allowed: ["ADMINISTRATOR"], call: (role) => sessions[role].agent.post("/api/admin/users").set(headers(role)).send({}) },
    ];
    for (const row of matrix) {
      for (const role of Object.keys(sessions) as Role[]) {
        const response = await row.call(role);
        if (row.allowed.includes(role)) {
          expect(response.status, `${row.name} as ${role}`).not.toBe(403);
          expect(response.status, `${row.name} as ${role}`).not.toBe(401);
        } else {
          expect(response.status, `${row.name} as ${role}`).toBe(403);
          expect(response.body, `${row.name} as ${role}`).toEqual({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } });
        }
      }
    }
  });

  it("returns 401 for every protected family without a session", async () => {
    for (const path of ["/api/tickets", "/api/staff/tickets", `/api/staff/tickets/${staffTicketId}`, `/api/staff/tickets/${staffTicketId}/internal-notes`, "/api/admin/users", "/api/auth/me", "/api/app"]) {
      const response = await request(app).get(path);
      expect(response.status, path).toBe(401);
      expect(JSON.stringify(response.body)).not.toMatch(/TKT-|@example\.test/);
    }
  });
});

describe("SEC-02 Issue #38 cross-feature authentication, administration, and workflow", () => {
  it("revokes a Staff session when an Administrator changes the role, and the new Requester cannot reach Staff operations", async () => {
    const admin = await signedInAgent("araya.admin@example.test");
    const created = await admin.agent.post("/api/admin/users").set("Origin", origin).set("X-CSRF-Token", admin.csrfToken).send({ displayName: "Issue 38 Cross Feature", email: `issue38-cross-${Date.now()}@example.test`, role: "IT_STAFF", isActive: true, initialPassword: "Cross!Feature-38" });
    expect(created.status).toBe(201);
    const staffAgent = request.agent(app);
    const login = await staffAgent.post("/api/auth/login").set("Origin", origin).send({ email: created.body.data.email, password: "Cross!Feature-38" });
    expect(login.body.data.mustChangePassword).toBe(true);
    expect((await staffAgent.get("/api/staff/tickets")).status).toBe(403);
    const changed = await staffAgent.post("/api/auth/change-password").set("Origin", origin).set("X-CSRF-Token", login.body.data.csrfToken).send({ currentPassword: "Cross!Feature-38", newPassword: "Cross!Changed-38" });
    expect(changed.status).toBe(200);
    expect((await staffAgent.get("/api/staff/tickets")).status).toBe(200);

    const demoted = await admin.agent.patch(`/api/admin/users/${created.body.data.id}`).set("Origin", origin).set("X-CSRF-Token", admin.csrfToken).send({ displayName: "Issue 38 Cross Feature", email: created.body.data.email, role: "REQUESTER", isActive: true, version: created.body.data.version });
    expect(demoted.status, JSON.stringify(demoted.body)).toBe(200);
    expect((await staffAgent.get("/api/staff/tickets")).status).toBe(401);

    const requesterAgent = request.agent(app);
    expect((await requesterAgent.post("/api/auth/login").set("Origin", origin).send({ email: created.body.data.email, password: "Cross!Changed-38" })).status).toBe(200);
    expect((await requesterAgent.get("/api/staff/tickets")).status).toBe(403);
    expect((await requesterAgent.get(`/api/staff/tickets/${staffTicketId}/internal-notes`)).status).toBe(403);
    expect((await requesterAgent.get("/api/tickets")).status).toBe(200);

    await prisma.session.deleteMany({ where: { userId: created.body.data.id } });
    await prisma.credential.deleteMany({ where: { userId: created.body.data.id } });
    await prisma.user.delete({ where: { id: created.body.data.id } });
  });
});
