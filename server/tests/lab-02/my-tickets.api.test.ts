import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const createdTicketIds: string[] = [];

async function createTicket(
  requesterId: number,
  overrides: Partial<{
    categoryId: number;
    relatedSystemId: number;
    summary: string;
    requestedPriority: "LOW" | "MEDIUM" | "HIGH";
  }> = {},
) {
  const response = await request(app)
    .post("/api/tickets")
    .set("X-Requester-Id", String(requesterId))
    .send({
      categoryId: 2,
      relatedSystemId: 7,
      summary: "Laptop battery drains quickly",
      requestedPriority: "MEDIUM",
      description: "Battery falls from full to 20% within one hour.",
      ...overrides,
    });

  expect(response.status).toBe(201);
  createdTicketIds.push(response.body.data.id);
  return response.body.data;
}

afterEach(async () => {
  if (createdTicketIds.length > 0) {
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    createdTicketIds.length = 0;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Issue #14 My Tickets API", () => {
  it("returns only the selected Requester's tickets with pagination metadata", async () => {
    const owned = await createTicket(1);
    await createTicket(2, { summary: "Mali's VPN access issue" });

    const response = await request(app)
      .get("/api/tickets?page=1&pageSize=10")
      .set("X-Requester-Id", "1");

    expect(response.status).toBe(200);
    expect(response.body.data.map((ticket: { id: string }) => ticket.id)).toEqual([
      owned.id,
    ]);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  it("applies search, combined filters, sorting, and returns an empty beyond-end page", async () => {
    await createTicket(1, {
      categoryId: 1,
      summary: "VPN access issue",
      requestedPriority: "HIGH",
    });
    await createTicket(1, {
      categoryId: 2,
      summary: "Laptop battery issue",
      requestedPriority: "MEDIUM",
    });

    const filtered = await request(app)
      .get(
        "/api/tickets?search=VPN&categoryId=1&status=NEW&requestedPriority=HIGH&sortBy=summary&sortOrder=asc",
      )
      .set("X-Requester-Id", "1");

    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0]).toMatchObject({
      summary: "VPN access issue",
      category: { id: 1 },
      requestedPriority: "HIGH",
    });

    const beyondEnd = await request(app)
      .get("/api/tickets?page=2&pageSize=10")
      .set("X-Requester-Id", "1");
    expect(beyondEnd.status).toBe(200);
    expect(beyondEnd.body.data).toEqual([]);
    expect(beyondEnd.body.pagination.page).toBe(2);
  });

  it.each([
    ["category", "categoryId=1", "VPN access issue"],
    ["related system", "relatedSystemId=7", "VPN access issue"],
    ["requested priority", "requestedPriority=HIGH", "VPN access issue"],
  ])("applies the %s filter", async (_label, query, expectedSummary) => {
    await createTicket(1, {
      categoryId: 1,
      relatedSystemId: 7,
      summary: "VPN access issue",
      requestedPriority: "HIGH",
    });
    await createTicket(1, {
      categoryId: 2,
      relatedSystemId: 6,
      summary: "Printer issue",
      requestedPriority: "LOW",
    });

    const response = await request(app)
      .get(`/api/tickets?${query}`)
      .set("X-Requester-Id", "1");

    expect(response.status).toBe(200);
    expect(response.body.data.map((ticket: { summary: string }) => ticket.summary)).toEqual([
      expectedSummary,
    ]);
  });

  it("applies deterministic sort fields and directions", async () => {
    const first = await createTicket(1, { summary: "Alpha issue" });
    const second = await createTicket(1, { summary: "Beta issue" });

    const ascending = await request(app)
      .get("/api/tickets?sortBy=summary&sortOrder=asc")
      .set("X-Requester-Id", "1");
    const descending = await request(app)
      .get("/api/tickets?sortBy=summary&sortOrder=desc")
      .set("X-Requester-Id", "1");

    expect(ascending.body.data.map((ticket: { id: string }) => ticket.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(descending.body.data.map((ticket: { id: string }) => ticket.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("uses id as a stable tie-breaker when the primary sort value matches", async () => {
    const first = await createTicket(1, { summary: "Same summary" });
    const second = await createTicket(1, { summary: "Same summary" });

    const response = await request(app)
      .get("/api/tickets?sortBy=summary&sortOrder=asc")
      .set("X-Requester-Id", "1");

    expect(response.status).toBe(200);
    expect(response.body.data.map((ticket: { id: string }) => ticket.id)).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it("returns the requested page slice and accurate page metadata", async () => {
    for (let index = 0; index < 11; index += 1) {
      await createTicket(1, { summary: `Pagination ticket ${index}` });
    }

    const firstPage = await request(app)
      .get("/api/tickets?page=1&pageSize=10")
      .set("X-Requester-Id", "1");
    const secondPage = await request(app)
      .get("/api/tickets?page=2&pageSize=10")
      .set("X-Requester-Id", "1");

    expect(firstPage.body.data).toHaveLength(10);
    expect(firstPage.body.pagination).toMatchObject({
      totalItems: 11,
      totalPages: 2,
      hasPreviousPage: false,
      hasNextPage: true,
    });
    expect(secondPage.body.data).toHaveLength(1);
    expect(secondPage.body.pagination).toMatchObject({
      page: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });

  it.each([
    "/api/tickets?page=0",
    "/api/tickets?pageSize=15",
    "/api/tickets?sortBy=id",
    "/api/tickets?page=1&page=2",
  ])("rejects invalid query: %s", async (path) => {
    const response = await request(app)
      .get(path)
      .set("X-Requester-Id", "1");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "INVALID_QUERY" });
  });

  it("returns a safe 500 response for an unexpected list failure", async () => {
    const countSpy = vi
      .spyOn(prisma.ticket, "count")
      .mockRejectedValue(new Error("database secret"));

    const response = await request(app)
      .get("/api/tickets")
      .set("X-Requester-Id", "1");

    countSpy.mockRestore();
    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Tickets could not be loaded. Please try again.",
    });
    expect(JSON.stringify(response.body)).not.toContain("database secret");
  });
});
