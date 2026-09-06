import { describe, expect, it } from "vitest";
import request, { type Test } from "supertest";
import { app } from "../../src/app.js";

const resourceId = "00000000-0000-4000-8000-000000000000";

function addContext(testRequest: Test, requesterId: string | undefined) {
  return requesterId === undefined
    ? testRequest
    : testRequest.set("X-Requester-Id", requesterId);
}

describe("Issue #17 requester-context endpoint matrix", () => {
  it.each([
    ["missing", undefined],
    ["malformed", "not-a-requester"],
    ["inactive", "5"],
  ])("rejects %s context consistently across every scoped endpoint family", async (
    _label,
    requesterId,
  ) => {
    const calls = [
      () => request(app).post("/api/tickets").send({
        categoryId: 1,
        relatedSystemId: 1,
        summary: "Context matrix ticket",
        requestedPriority: "LOW",
        description: "This request must be rejected before ticket creation.",
      }),
      () => request(app).get("/api/tickets"),
      () => request(app).get(`/api/tickets/${resourceId}`),
      () => request(app).get(`/api/tickets/${resourceId}/attachments`),
      () => request(app).get(`/api/attachments/${resourceId}/download`),
      () => request(app).delete(`/api/attachments/${resourceId}`).send({
        reason: "This request must never mutate attachment state.",
      }),
      () => request(app)
        .post(`/api/tickets/${resourceId}/attachments`)
        .attach("file", Buffer.from("%PDF-1.7\ncontext"), {
          filename: "context.pdf",
          contentType: "application/pdf",
        }),
    ];

    for (const makeCall of calls) {
      const response = await addContext(makeCall(), requesterId);
      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        code: "INVALID_REQUESTER_CONTEXT",
        message: "A valid Development Requester context is required.",
      });
    }
  });
});
