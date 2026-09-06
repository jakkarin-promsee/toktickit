import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const validTicket = {
  categoryId: 2,
  relatedSystemId: 7,
  summary: "  Laptop battery drains quickly  ",
  requestedPriority: "MEDIUM",
  description: "Battery falls from full to 20% within one hour.",
};

afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("Issue #13 ticket creation API", () => {
  it("returns active categories and related systems", async () => {
    const [categories, systems] = await Promise.all([
      request(app).get("/api/categories"),
      request(app).get("/api/related-systems"),
    ]);

    expect(categories.status).toBe(200);
    expect(categories.body.map((item: { name: string }) => item.name)).toContain(
      "Hardware",
    );
    expect(systems.status).toBe(200);
    expect(
      systems.body.map((item: { name: string }) => item.name),
    ).toContain("Corporate Laptop");
  });

  it("creates one owned New ticket with a backend-generated number", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send(validTicket);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      requester: { id: 1, displayName: "Anan Chai" },
      category: { id: 2, name: "Hardware" },
      relatedSystem: { id: 7, name: "Corporate Laptop" },
      summary: "Laptop battery drains quickly",
      description: "Battery falls from full to 20% within one hour.",
      requestedPriority: "MEDIUM",
      currentStatus: "NEW",
      itPriority: "UNASSIGNED",
    });
    expect(response.body.data.ticketNumber).toMatch(/^TKT-\d{8}-\d{6}$/);
    expect(response.body.data.ticketDate).toBe(response.body.data.createdAt);

    await getPrisma().ticket.delete({ where: { id: response.body.data.id } });
  });

  it("rejects invalid input without creating a ticket", async () => {
    const before = await getPrisma().ticket.count();
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send({
        ...validTicket,
        summary: "bad",
        description: "short",
        requestedPriority: "URGENT",
      });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(response.body.error.fields).toMatchObject({
      summary: expect.any(String),
      description: expect.any(String),
      requestedPriority: expect.any(String),
    });
    expect(await getPrisma().ticket.count()).toBe(before);
  });

  it.each([
    ["missing", undefined],
    ["malformed", "not-a-requester"],
    ["inactive", "5"],
  ])("rejects %s requester context", async (_label, requesterId) => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", requesterId ?? "")
      .send(validTicket);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUESTER_CONTEXT");
  });

  it("does not accept requester or generated values from the client", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set("X-Requester-Id", "1")
      .send({ ...validTicket, requesterId: 2, currentStatus: "CLOSED" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("MALFORMED_REQUEST");
  });
});
