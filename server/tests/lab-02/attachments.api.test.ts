import fs from "node:fs/promises";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const ticketIds: string[] = [];
const attachmentIds: string[] = [];

const pdf = (content = "attachment content") =>
  Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from(content)]);

async function createTicket(requesterId = 1) {
  const response = await request(app)
    .post("/api/tickets")
    .set("X-Requester-Id", String(requesterId))
    .send({
      categoryId: 2,
      relatedSystemId: 7,
      summary: "Attachment lifecycle test ticket",
      requestedPriority: "MEDIUM",
      description: "This ticket is used to test attachment behavior.",
    });
  expect(response.status).toBe(201);
  ticketIds.push(response.body.data.id);
  return response.body.data;
}

async function upload(
  ticketId: string,
  requesterId = 1,
  name = "evidence.pdf",
  contents = pdf(),
  contentType = "application/pdf",
) {
  const response = await request(app)
    .post(`/api/tickets/${ticketId}/attachments`)
    .set("X-Requester-Id", String(requesterId))
    .attach("file", contents, { filename: name, contentType });
  if (response.body.data?.id) attachmentIds.push(response.body.data.id);
  return response;
}

afterEach(async () => {
  if (attachmentIds.length) {
    await prisma.attachment.deleteMany({ where: { id: { in: attachmentIds } } });
    attachmentIds.length = 0;
  }
  if (ticketIds.length) {
    await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
    ticketIds.length = 0;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Issue #16 attachment lifecycle API", () => {
  it("accepts an exact 5 MiB PDF through the multipart endpoint", async () => {
    const ticket = await createTicket();
    const contents = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(5 * 1024 * 1024 - 9)]);
    const uploaded = await upload(ticket.id, 1, "boundary.pdf", contents);

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data.sizeBytes).toBe(5 * 1024 * 1024);
  });

  it("uploads, lists, downloads, and soft-removes an owned attachment", async () => {
    const ticket = await createTicket();
    const uploaded = await upload(ticket.id);

    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).toMatchObject({
      originalName: "evidence.pdf",
      mimeType: "application/pdf",
      state: "ACTIVE",
      sizeBytes: expect.any(Number),
    });

    const listed = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1");
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);

    const downloaded = await request(app)
      .get(`/api/attachments/${uploaded.body.data.id}/download`)
      .set("X-Requester-Id", "1");
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toContain("application/pdf");
    expect(downloaded.body.toString()).toContain("%PDF-1.7");

    const removed = await request(app)
      .delete(`/api/attachments/${uploaded.body.data.id}`)
      .set("X-Requester-Id", "1")
      .send({ reason: "The evidence is no longer needed." });
    expect(removed.status).toBe(200);
    expect(removed.body.data).toMatchObject({
      id: uploaded.body.data.id,
      state: "REMOVED",
      removalReason: "The evidence is no longer needed.",
    });

    const blocked = await request(app)
      .get(`/api/attachments/${uploaded.body.data.id}/download`)
      .set("X-Requester-Id", "1");
    expect(blocked.status).toBe(410);
    expect(blocked.body.error.code).toBe("ATTACHMENT_REMOVED");

    const duplicateRemoval = await request(app)
      .delete(`/api/attachments/${uploaded.body.data.id}`)
      .set("X-Requester-Id", "1")
      .send({ reason: "The evidence is no longer needed." });
    expect(duplicateRemoval.status).toBe(409);
  });

  it("rejects invalid files, a sixth active file, and cross-requester access", async () => {
    const ticket = await createTicket();
    const invalid = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", Buffer.from("not an image"), {
        filename: "evidence.png",
        contentType: "image/png",
      });
    expect(invalid.status).toBe(415);

    const otherTicket = await createTicket(2);
    const crossOwner = await upload(otherTicket.id, 1);
    expect(crossOwner.status).toBe(404);

    for (let index = 0; index < 5; index += 1) {
      expect((await upload(ticket.id, 1, `evidence-${index}.pdf`)).status).toBe(201);
    }
    expect((await upload(ticket.id)).status).toBe(422);
  });

  it("allows only one concurrent upload to claim the final active slot", async () => {
    const ticket = await createTicket();
    for (let index = 0; index < 4; index += 1) {
      expect((await upload(ticket.id, 1, `existing-${index}.pdf`)).status).toBe(201);
    }

    const results = await Promise.all([
      upload(ticket.id, 1, "final-a.pdf"),
      upload(ticket.id, 1, "final-b.pdf"),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 422]);
  });

  it("rejects missing or multiple file parts", async () => {
    const ticket = await createTicket();
    const missing = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1");
    expect(missing.status).toBe(400);

    const multiple = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .set("X-Requester-Id", "1")
      .attach("file", pdf("one"), { filename: "one.pdf", contentType: "application/pdf" })
      .attach("file", pdf("two"), { filename: "two.pdf", contentType: "application/pdf" });
    expect(multiple.status).toBe(400);
  });

  it("cleans up when attachment storage is unavailable", async () => {
    const ticket = await createTicket();
    const writeFileSpy = vi.spyOn(fs, "writeFile").mockRejectedValueOnce(new Error("disk secret"));

    const response = await upload(ticket.id);

    writeFileSpy.mockRestore();
    expect(response.status).toBe(503);
    expect(response.body.error).toEqual({
      code: "ATTACHMENT_UNAVAILABLE",
      message: "Attachment storage is temporarily unavailable.",
    });
    expect(await prisma.attachment.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it("requires a valid removal reason and returns the same safe 404 for another requester", async () => {
    const ticket = await createTicket();
    const uploaded = await upload(ticket.id);

    const invalidReason = await request(app)
      .delete(`/api/attachments/${uploaded.body.data.id}`)
      .set("X-Requester-Id", "1")
      .send({ reason: "short" });
    expect(invalidReason.status).toBe(422);

    const other = await request(app)
      .get(`/api/attachments/${uploaded.body.data.id}/download`)
      .set("X-Requester-Id", "2");
    expect(other.status).toBe(404);
    expect(other.body).toEqual({
      error: { code: "RESOURCE_NOT_FOUND", message: "Attachment was not found." },
    });

    const invalidContext = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments`);
    expect(invalidContext.status).toBe(400);
    expect(invalidContext.body.error.code).toBe("INVALID_REQUESTER_CONTEXT");
  });
});
