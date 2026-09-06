import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const createdTicketIds: string[] = [];
const createdAttachmentIds: string[] = [];

async function createTicket(requesterId: number) {
  const response = await request(app)
    .post("/api/tickets")
    .set("X-Requester-Id", String(requesterId))
    .send({
      categoryId: 2,
      relatedSystemId: 7,
      summary: "Laptop battery drains quickly",
      requestedPriority: "MEDIUM",
      description: "Battery falls from full to 20% within one hour.",
    });

  expect(response.status).toBe(201);
  createdTicketIds.push(response.body.data.id);
  return response.body.data;
}

afterEach(async () => {
  if (createdAttachmentIds.length > 0) {
    await prisma.attachment.deleteMany({ where: { id: { in: createdAttachmentIds } } });
    createdAttachmentIds.length = 0;
  }
  if (createdTicketIds.length > 0) {
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    createdTicketIds.length = 0;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Issue #15 Requester-owned Ticket Detail API", () => {
  it("returns the complete owned Ticket and public Attachment metadata", async () => {
    const ticket = await createTicket(1);
    const attachment = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        originalName: "diagnostic.pdf",
        storageName: "generated-storage-name.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1234,
        sha256: "a".repeat(64),
        uploadedByRequesterId: 1,
      },
    });
    createdAttachmentIds.push(attachment.id);

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set("X-Requester-Id", "1");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketDate: ticket.ticketDate,
      requester: { id: 1, displayName: expect.any(String) },
      category: { id: 2, name: "Hardware" },
      relatedSystem: { id: 7, name: "Corporate Laptop" },
      summary: "Laptop battery drains quickly",
      requestedPriority: "MEDIUM",
      itPriority: "UNASSIGNED",
      currentStatus: "NEW",
      description: "Battery falls from full to 20% within one hour.",
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
    expect(response.body.data.attachments).toEqual([
      {
        id: attachment.id,
        originalName: "diagnostic.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1234,
        state: "ACTIVE",
        uploadedByDisplayName: expect.any(String),
        createdAt: attachment.createdAt.toISOString(),
        removedAt: null,
        removedByDisplayName: null,
        removalReason: null,
      },
    ]);
    expect(JSON.stringify(response.body)).not.toContain("generated-storage-name.pdf");
    expect(JSON.stringify(response.body)).not.toContain("a".repeat(64));
  });

  it("returns the same safe 404 for a missing and cross-requester Ticket", async () => {
    const ownedByOtherRequester = await createTicket(2);
    const missingId = "00000000-0000-4000-8000-000000000000";

    const otherResponse = await request(app)
      .get(`/api/tickets/${ownedByOtherRequester.id}`)
      .set("X-Requester-Id", "1");
    const missingResponse = await request(app)
      .get(`/api/tickets/${missingId}`)
      .set("X-Requester-Id", "1");

    expect(otherResponse.status).toBe(404);
    expect(otherResponse.body).toEqual({
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: "Ticket was not found.",
      },
    });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body).toEqual(otherResponse.body);
  });

  it("rejects malformed IDs and invalid requester context safely", async () => {
    const malformed = await request(app)
      .get("/api/tickets/not-a-uuid")
      .set("X-Requester-Id", "1");
    const invalidContext = await request(app).get("/api/tickets/not-a-uuid");

    expect(malformed.status).toBe(400);
    expect(malformed.body.error).toEqual({
      code: "INVALID_TICKET_ID",
      message: "Ticket ID must be a valid UUID.",
    });
    expect(invalidContext.status).toBe(400);
    expect(invalidContext.body.error.code).toBe("INVALID_REQUESTER_CONTEXT");
  });

  it("returns safe dependency and unexpected failure responses", async () => {
    const ticket = await createTicket(1);
    const findFirstSpy = vi
      .spyOn(prisma.ticket, "findFirst")
      .mockRejectedValueOnce(new Error("database secret"));

    const response = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set("X-Requester-Id", "1");

    findFirstSpy.mockRestore();
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Ticket could not be loaded. Please try again.",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("database secret");
  });
});
