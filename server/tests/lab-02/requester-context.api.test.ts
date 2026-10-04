import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const resourceId = "00000000-0000-4000-8000-000000000000";

afterAll(async () => { await getPrisma().$disconnect(); });

describe("Issue #17 authenticated requester endpoint matrix", () => {
  it("rejects unauthenticated Ticket and Attachment requests before resource lookup", async () => {
    const calls = [
      request(app).post("/api/tickets").send({ categoryId: 1, relatedSystemId: 1, summary: "Unauthenticated requester test", requestedPriority: "LOW", description: "This request must not create a Ticket without a session." }),
      request(app).get("/api/tickets"),
      request(app).get(`/api/tickets/${resourceId}`),
      request(app).get(`/api/tickets/${resourceId}/attachments`),
      request(app).get(`/api/attachments/${resourceId}/download`),
      request(app).delete(`/api/attachments/${resourceId}`).send({ reason: "This must not mutate without a session." }),
    ];
    for (const response of await Promise.all(calls)) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    }
  });
});
