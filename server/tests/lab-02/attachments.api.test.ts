import { afterAll, afterEach, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { csrfHeaders, requesterSession } from "../lab-03/requester-test-session.js";

const prisma = getPrisma();
const ticketIds: string[] = [];
const attachmentIds: string[] = [];
const pdf = Buffer.from("%PDF-1.7\nauthenticated attachment");

async function ticketFor(email = "anan@example.test") {
  const session = await requesterSession(email);
  const created = await session.agent.post("/api/tickets").set(csrfHeaders(session.csrfToken)).send({ categoryId: 2, relatedSystemId: 7, summary: "Authenticated attachment lifecycle", requestedPriority: "MEDIUM", description: "This Ticket verifies that Attachment lifecycle operations use the signed-in User." });
  expect(created.status).toBe(201);
  ticketIds.push(created.body.data.id);
  return { ...session, ticketId: created.body.data.id };
}

afterEach(async () => { if (attachmentIds.length) { await prisma.attachment.deleteMany({ where: { id: { in: attachmentIds } } }); attachmentIds.length = 0; } if (ticketIds.length) { await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } }); ticketIds.length = 0; } });
afterAll(async () => { await prisma.$disconnect(); });

describe("Issue #16 authenticated attachment lifecycle API", () => {
  it("uploads, lists, downloads, and soft-removes an owned Attachment with CSRF", async () => {
    const session = await ticketFor();
    const uploaded = await session.agent.post(`/api/tickets/${session.ticketId}/attachments`).set(csrfHeaders(session.csrfToken)).attach("file", pdf, { filename: "evidence.pdf", contentType: "application/pdf" });
    expect(uploaded.status).toBe(201);
    attachmentIds.push(uploaded.body.data.id);
    expect((await session.agent.get(`/api/tickets/${session.ticketId}/attachments`)).status).toBe(200);
    expect((await session.agent.get(`/api/attachments/${uploaded.body.data.id}/download`)).status).toBe(200);
    const removed = await session.agent.delete(`/api/attachments/${uploaded.body.data.id}`).set(csrfHeaders(session.csrfToken)).send({ reason: "The evidence is no longer needed." });
    expect(removed.status).toBe(200);
    expect(removed.body.data.state).toBe("REMOVED");
  });

  it("does not disclose another Requester's Attachment", async () => {
    const owner = await ticketFor("mali@example.test");
    const other = await requesterSession("anan@example.test");
    const uploaded = await owner.agent.post(`/api/tickets/${owner.ticketId}/attachments`).set(csrfHeaders(owner.csrfToken)).attach("file", pdf, { filename: "private.pdf", contentType: "application/pdf" });
    attachmentIds.push(uploaded.body.data.id);
    const crossOwner = await other.agent.get(`/api/attachments/${uploaded.body.data.id}/download`);
    const missing = await other.agent.get("/api/attachments/00000000-0000-4000-8000-000000000000/download");
    expect(crossOwner.status).toBe(404);
    expect(crossOwner.body).toEqual(missing.body);
  });
});
