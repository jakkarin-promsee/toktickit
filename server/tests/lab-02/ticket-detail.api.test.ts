import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { csrfHeaders, requesterSession } from "../lab-03/requester-test-session.js";

const prisma = getPrisma();

afterAll(async () => { await prisma.$disconnect(); });

describe("Issue #15 authenticated Requester Ticket Detail API", () => {
  it("returns an owned Ticket and the same safe 404 for cross-owner and absent Ticket IDs", async () => {
    const anan = await requesterSession("anan@example.test");
    const mali = await requesterSession("mali@example.test");
    const created = await mali.agent.post("/api/tickets").set(csrfHeaders(mali.csrfToken)).send({ categoryId: 2, relatedSystemId: 7, summary: "Mali detail ownership test", requestedPriority: "MEDIUM", description: "This Ticket verifies that detail ownership is determined by the signed-in User." });
    expect(created.status).toBe(201);
    const own = await mali.agent.get(`/api/tickets/${created.body.data.id}`);
    const crossOwner = await anan.agent.get(`/api/tickets/${created.body.data.id}`);
    const missing = await anan.agent.get("/api/tickets/00000000-0000-4000-8000-000000000000");
    expect(own.status).toBe(200);
    expect(crossOwner.status).toBe(404);
    expect(crossOwner.body).toEqual(missing.body);
    await prisma.ticket.delete({ where: { id: created.body.data.id } });
  });
});
