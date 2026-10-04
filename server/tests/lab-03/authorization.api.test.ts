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
