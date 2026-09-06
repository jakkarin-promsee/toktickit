import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const ticketId = "ticket-attachment";
const removedAttachment = {
  id: "attachment-removed",
  originalName: "evidence.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1234,
  state: "REMOVED",
  uploadedByDisplayName: "Anan Chai",
  createdAt: "2026-09-06T03:12:00.000Z",
  removedAt: "2026-09-06T04:00:00.000Z",
  removedByDisplayName: "Anan Chai",
  removalReason: "The evidence is no longer needed.",
};

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("AttachmentSection", () => {
  it("retains removed metadata and hides download and removal actions", async () => {
    localStorage.setItem("toktickit.requesterId", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith("/api/requesters")) {
          return Promise.resolve(response({ data: [{ id: 1, displayName: "Anan Chai", email: "anan@example.test" }] }));
        }
        if (url.endsWith("/api/categories")) return Promise.resolve(response([{ id: 2, name: "Hardware" }]));
        if (url.endsWith("/api/related-systems")) return Promise.resolve(response([{ id: 7, name: "Corporate Laptop" }]));
        if (url.includes("/api/tickets?")) {
          return Promise.resolve(response({
            data: [{
              id: ticketId,
              ticketNumber: "TKT-20260906-000001",
              summary: "Attachment test",
              category: { id: 2, name: "Hardware" },
              relatedSystem: { id: 7, name: "Corporate Laptop" },
              requestedPriority: "MEDIUM",
              itPriority: "UNASSIGNED",
              currentStatus: "NEW",
              createdAt: "2026-09-06T03:12:00.000Z",
              updatedAt: "2026-09-06T03:12:00.000Z",
            }],
            pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
          }));
        }
        if (url.endsWith(`/api/tickets/${ticketId}`)) {
          return Promise.resolve(response({
            data: {
              id: ticketId,
              ticketNumber: "TKT-20260906-000001",
              ticketDate: "2026-09-06T03:12:00.000Z",
              requester: { id: 1, displayName: "Anan Chai" },
              category: { id: 2, name: "Hardware" },
              relatedSystem: { id: 7, name: "Corporate Laptop" },
              summary: "Attachment test",
              requestedPriority: "MEDIUM",
              itPriority: "UNASSIGNED",
              currentStatus: "NEW",
              description: "This is an attachment test.",
              createdAt: "2026-09-06T03:12:00.000Z",
              updatedAt: "2026-09-06T03:12:00.000Z",
              attachments: [removedAttachment],
            },
          }));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }),
    );

    const user = userEvent.setup();
    render(<App />);
    await user.click((await screen.findAllByRole("link", { name: "View ticket" }))[0]);

    expect(await screen.findByText("evidence.pdf")).toBeInTheDocument();
    expect(screen.getByText("REMOVED")).toBeInTheDocument();
    expect(screen.getByText(/Unavailable for download/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
