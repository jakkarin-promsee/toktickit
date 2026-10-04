import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { csrfHeaders, requesterSession } from "../lab-03/requester-test-session.js";

const prisma = getPrisma();
const createdTicketIds: string[] = [];

async function createTicket(email: string, summary: string) {
  const { agent, csrfToken } = await requesterSession(email);
  const response = await agent.post("/api/tickets").set(csrfHeaders(csrfToken)).send({ categoryId: 2, relatedSystemId: 7, summary, requestedPriority: "MEDIUM", description: "This authenticated requester Ticket verifies list ownership and query behavior." });
  expect(response.status).toBe(201);
  createdTicketIds.push(response.body.data.id);
  return { agent, ticket: response.body.data };
}

afterEach(async () => { if (createdTicketIds.length) { await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } }); createdTicketIds.length = 0; } });
afterAll(async () => { await prisma.$disconnect(); });

describe("Issue #14 authenticated My Tickets API", () => {
  it("returns only the signed-in Requester's Tickets even when the client forges a requester header", async () => {
    const anan = await createTicket("anan@example.test", "Anan VPN access issue");
    await createTicket("mali@example.test", "Mali VPN access issue");
    const response = await anan.agent.get("/api/tickets?search=VPN").set("X-Requester-Id", "2");
    expect(response.status).toBe(200);
    expect(response.body.data.map((ticket: { id: string }) => ticket.id)).toContain(anan.ticket.id);
    expect(response.body.data.map((ticket: { summary: string }) => ticket.summary)).not.toContain("Mali VPN access issue");
    expect(response.body.pagination).toMatchObject({ page: 1 });
  });

  it("keeps query validation and pagination behavior under an authenticated session", async () => {
    const anan = await createTicket("anan@example.test", "Authenticated query ticket");
    expect((await anan.agent.get("/api/tickets?page=0")).status).toBe(400);
    const beyondEnd = await anan.agent.get("/api/tickets?page=2&pageSize=10");
    expect(beyondEnd.status).toBe(200);
    expect(beyondEnd.body.data).toEqual([]);
  });
});
