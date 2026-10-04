import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { csrfHeaders, requesterSession } from "../lab-03/requester-test-session.js";

const prisma = getPrisma();
const validTicket = { categoryId: 2, relatedSystemId: 7, summary: "  Laptop battery drains quickly  ", requestedPriority: "MEDIUM", description: "Battery falls from full to 20% within one hour." };

afterAll(async () => { await prisma.$disconnect(); });

describe("Issue #13 authenticated ticket creation API", () => {
  it("creates a New Ticket for the authenticated Requester and rejects forged identity fields", async () => {
    const { agent, csrfToken } = await requesterSession();
    const response = await agent.post("/api/tickets").set(csrfHeaders(csrfToken)).set("X-Requester-Id", "2").send(validTicket);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ requester: { id: 1, displayName: "Anan Chai" }, summary: "Laptop battery drains quickly", currentStatus: "NEW", itPriority: "MEDIUM" });
    await prisma.ticket.delete({ where: { id: response.body.data.id } });
  });

  it("rejects missing session, missing CSRF, and invalid Ticket input without persisting", async () => {
    expect((await request(app).post("/api/tickets").send(validTicket)).status).toBe(401);
    const { agent, csrfToken } = await requesterSession();
    expect((await agent.post("/api/tickets").send(validTicket)).status).toBe(403);
    const before = await prisma.ticket.count();
    const invalid = await agent.post("/api/tickets").set(csrfHeaders(csrfToken)).send({ ...validTicket, summary: "bad", requestedPriority: "URGENT" });
    expect(invalid.status).toBe(422);
    expect(await prisma.ticket.count()).toBe(before);
  });
});
