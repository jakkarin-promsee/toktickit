import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { csrfHeaders, requesterSession } from "./requester-test-session.js";

const prisma = getPrisma();
const createdTicketIds: string[] = [];
const initialPassword = process.env.LAB3_SEED_INITIAL_PASSWORD!;
const origin = "http://localhost:5173";
const MISSING_ID = "99999999-9999-4999-8999-999999999999";

async function makeTicket(email: string, status: "NEW" | "WAITING_FOR_REQUESTER" | "RESOLVED") {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const category = await prisma.category.findFirstOrThrow();
  const system = await prisma.relatedSystem.findFirstOrThrow();
  const count = await prisma.ticket.count();
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TKT-20261004-8${String(count).padStart(5, "0")}`,
      submittedByUserId: user.id,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: "Resolution signal test",
      description: "Created by the resolution API test.",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus: status,
    },
  });
  createdTicketIds.push(ticket.id);
  return ticket;
}

beforeAll(async () => {
  await prisma.user.updateMany({ where: { email: "narin.staff@example.test" }, data: { mustChangePassword: false } });
});

afterAll(async () => {
  await prisma.internalNote.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.publicComment.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  await prisma.user.updateMany({
    where: { email: { in: ["anan@example.test", "mali@example.test", "narin.staff@example.test", "araya.admin@example.test"] } },
    data: { mustChangePassword: true },
  });
  await prisma.$disconnect();
});

describe("API-06 Problem Appears Resolved", () => {
  it("records the signal without changing status and increments the version", async () => {
    const ticket = await makeTicket("anan@example.test", "WAITING_FOR_REQUESTER");
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    const detail = await agent.get(`/api/tickets/${ticket.id}`);
    expect(detail.body.data.requesterResolvedAt).toBeNull();
    const response = await agent.post(`/api/tickets/${ticket.id}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version: detail.body.data.version });
    expect(response.status).toBe(200);
    expect(response.body.data.currentStatus).toBe("WAITING_FOR_REQUESTER");
    expect(response.body.data.requesterResolvedAt).toBeTruthy();
    expect(response.body.data.version).toBe(detail.body.data.version + 1);
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    const anan = await prisma.user.findUniqueOrThrow({ where: { email: "anan@example.test" } });
    expect(stored.requesterResolvedByUserId).toBe(anan.id);
    expect(stored.currentStatus).toBe("WAITING_FOR_REQUESTER");
  });

  it("rejects a repeated signal with RESOLUTION_ALREADY_INDICATED", async () => {
    const ticket = await makeTicket("anan@example.test", "WAITING_FOR_REQUESTER");
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    const first = await agent.post(`/api/tickets/${ticket.id}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version: 0 });
    expect(first.status).toBe(200);
    const second = await agent.post(`/api/tickets/${ticket.id}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version: 1 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("RESOLUTION_ALREADY_INDICATED");
  });

  it("allows only one winner for concurrent duplicate clicks", async () => {
    const ticket = await makeTicket("anan@example.test", "WAITING_FOR_REQUESTER");
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    const results = await Promise.all([1, 2, 3].map(() => agent.post(`/api/tickets/${ticket.id}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version: 0 })));
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(2);
  });

  it("rejects wrong status, stale version, and invalid version", async () => {
    const fresh = await makeTicket("anan@example.test", "NEW");
    const resolved = await makeTicket("anan@example.test", "RESOLVED");
    const waiting = await makeTicket("anan@example.test", "WAITING_FOR_REQUESTER");
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    for (const ticket of [fresh, resolved]) {
      const response = await agent.post(`/api/tickets/${ticket.id}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version: 0 });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("INVALID_TICKET_STATE");
    }
    const stale = await agent.post(`/api/tickets/${waiting.id}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version: 7 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_TICKET");
    for (const version of [-1, 1.5, "0", null]) {
      const invalid = await agent.post(`/api/tickets/${waiting.id}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version });
      expect(invalid.status).toBe(422);
    }
    const extra = await agent.post(`/api/tickets/${waiting.id}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version: 0, status: "RESOLVED" });
    expect(extra.status).toBe(400);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: waiting.id } })).requesterResolvedAt).toBeNull();
  });

  it("hides cross-owner tickets and blocks Staff, Administrator, anonymous, and missing-CSRF callers", async () => {
    const ticket = await makeTicket("mali@example.test", "WAITING_FOR_REQUESTER");
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    const other = await agent.post(`/api/tickets/${ticket.id}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version: 0 });
    const missing = await agent.post(`/api/tickets/${MISSING_ID}/problem-appears-resolved`).set(csrfHeaders(csrfToken)).send({ version: 0 });
    expect(other.status).toBe(404);
    expect(other.body).toEqual(missing.body);
    const noCsrf = await agent.post(`/api/tickets/${ticket.id}/problem-appears-resolved`).set("Origin", origin).send({ version: 0 });
    expect(noCsrf.status).toBe(403);
    expect((await request(app).post(`/api/tickets/${ticket.id}/problem-appears-resolved`).set("Origin", origin).send({ version: 0 })).status).toBe(401);
    for (const email of ["narin.staff@example.test", "araya.admin@example.test"]) {
      await prisma.user.update({ where: { email }, data: { mustChangePassword: false } });
      const session = request.agent(app);
      const login = await session.post("/api/auth/login").set("Origin", origin).send({ email, password: initialPassword });
      const response = await session.post(`/api/tickets/${ticket.id}/problem-appears-resolved`).set(csrfHeaders(login.body.data.csrfToken)).send({ version: 0 });
      expect(response.status).toBe(403);
    }
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).requesterResolvedAt).toBeNull();
  });

  it("gives a Requester no way to formally resolve or close a Ticket", async () => {
    const ticket = await makeTicket("anan@example.test", "WAITING_FOR_REQUESTER");
    const { agent, csrfToken } = await requesterSession("anan@example.test");
    for (const [method, path] of [["patch", `/api/tickets/${ticket.id}`], ["put", `/api/tickets/${ticket.id}`], ["post", `/api/tickets/${ticket.id}/status`], ["patch", `/api/staff/tickets/${ticket.id}/status`], ["post", `/api/staff/tickets/${ticket.id}/status`]] as const) {
      const response = await agent[method](path).set(csrfHeaders(csrfToken)).send({ status: "RESOLVED", currentStatus: "CLOSED", version: 0 });
      expect([403, 404]).toContain(response.status);
    }
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe("WAITING_FOR_REQUESTER");
  });
});
