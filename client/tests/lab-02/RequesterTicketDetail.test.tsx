import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const ticket = {
  id: "ticket-1",
  ticketNumber: "TKT-20260906-000001",
  ticketDate: "2026-09-06T03:12:00.000Z",
  requester: { id: 1, displayName: "Anan Chai" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  summary: "Laptop battery drains quickly",
  requestedPriority: "MEDIUM",
  itPriority: "UNASSIGNED",
  currentStatus: "NEW",
  description: "Battery falls from full to 20% within one hour.",
  createdAt: "2026-09-06T03:12:00.000Z",
  updatedAt: "2026-09-06T03:12:00.000Z",
  attachments: [
    {
      id: "attachment-1",
      originalName: "diagnostic.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1234,
      state: "ACTIVE",
      uploadedByDisplayName: "Anan Chai",
      createdAt: "2026-09-06T03:12:00.000Z",
      removedAt: null,
      removedByDisplayName: null,
      removalReason: null,
    },
  ],
};

function setupFetch(detailResponse: unknown = { data: ticket }) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.endsWith("/api/requesters")) {
      return Promise.resolve(response({
        data: [{ id: 1, displayName: "Anan Chai", email: "anan@example.test" }],
      }));
    }
    if (url.endsWith("/api/categories")) {
      return Promise.resolve(response([{ id: 2, name: "Hardware" }]));
    }
    if (url.endsWith("/api/related-systems")) {
      return Promise.resolve(response([{ id: 7, name: "Corporate Laptop" }]));
    }
    if (url.includes("/api/tickets?")) {
      return Promise.resolve(response({
        data: [{
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          summary: ticket.summary,
          category: ticket.category,
          relatedSystem: ticket.relatedSystem,
          requestedPriority: ticket.requestedPriority,
          itPriority: ticket.itPriority,
          currentStatus: ticket.currentStatus,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        }],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      }));
    }
    if (url.endsWith(`/api/tickets/${ticket.id}`)) {
      return Promise.resolve(
        detailResponse instanceof Error
          ? Promise.reject(detailResponse)
          : response(detailResponse, detailResponse === null ? 404 : 200),
      );
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

async function openDetail(detailResponse: unknown = { data: ticket }) {
  localStorage.setItem("toktickit.requesterId", "1");
  const fetch = setupFetch(detailResponse);
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "My Tickets" });
  await waitFor(() => expect(screen.getAllByRole("link", { name: "View ticket" }).length).toBeGreaterThan(0));
  await user.click(screen.getAllByRole("link", { name: "View ticket" })[0]);
  return { fetch, user };
}

describe("Requester Ticket Detail", () => {
  it("opens an owned Ticket as read-only detail with separated attachment metadata", async () => {
    const { fetch } = await openDetail();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument(),
    );
    expect(screen.getByText(ticket.ticketNumber)).toBeInTheDocument();
    expect(screen.getByText(ticket.summary)).toBeInTheDocument();
    expect(screen.getByText(ticket.description)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attachments" })).toBeInTheDocument();
    expect(screen.getByText("diagnostic.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit|save|change status/i })).not.toBeInTheDocument();
    expect(fetch.mock.calls.some(([url, options]) =>
      String(url).endsWith(`/api/tickets/${ticket.id}`) &&
      (options as RequestInit)?.headers &&
      (options as { headers: Record<string, string> }).headers["X-Requester-Id"] === "1",
    )).toBe(true);
  });

  it("returns to My Tickets without losing requester context", async () => {
    const { user, fetch } = await openDetail();
    await screen.findByRole("heading", { name: "Ticket Detail" });
    await user.click(screen.getByRole("button", { name: "Back to My Tickets" }));

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/api/tickets?"))).toBe(true);
  });

  it("opens a direct Ticket hash immediately when the hash changes", async () => {
    localStorage.setItem("toktickit.requesterId", "1");
    const fetch = setupFetch();
    vi.stubGlobal("fetch", fetch);
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });

    act(() => {
      window.history.pushState(null, "", `#ticket-${ticket.id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument(),
    );
    expect(fetch.mock.calls.some(([url, options]) =>
      String(url).endsWith(`/api/tickets/${ticket.id}`) &&
      (options as { headers: Record<string, string> }).headers["X-Requester-Id"] === "1",
    )).toBe(true);
  });

  it("uses responsive detail structure for stacked small-screen fields", async () => {
    await openDetail();

    await screen.findByRole("heading", { name: "Ticket Detail" });
    expect(screen.getByRole("region", { name: "Ticket information" }).querySelector("dl"))
      .toHaveClass("row");
    expect(document.querySelector(".col-sm-4")).toBeInTheDocument();
    expect(document.querySelector(".col-sm-8")).toBeInTheDocument();
  });

  it("shows a safe not-found state", async () => {
    await openDetail(null);

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't find this ticket/i);
    expect(screen.queryByText(ticket.description)).not.toBeInTheDocument();
  });

  it("shows a safe unexpected-failure state without internal details", async () => {
    await openDetail(new Error("database secret"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load this ticket/i);
    });
    expect(screen.queryByText(/database secret/i)).not.toBeInTheDocument();
  });

  it("shows active attachment actions and validates the removal reason", async () => {
    const { user } = await openDetail();

    expect(await screen.findByRole("button", { name: "Download" })).toBeInTheDocument();
    const removeButton = screen.getByRole("button", { name: "Remove" });
    await user.click(removeButton);
    expect(screen.getByRole("dialog", { name: "Remove attachment?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Confirm removal" })).toBeDisabled();
    await user.type(screen.getByLabelText("Removal reason"), "short");
    expect(screen.getByRole("alert")).toHaveTextContent(/10–250 characters/i);
    await user.clear(screen.getByLabelText("Removal reason"));
    await user.type(screen.getByLabelText("Removal reason"), "The file is no longer needed.");
    expect(screen.getByRole("button", { name: "Confirm removal" })).toBeEnabled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(removeButton).toHaveFocus());
  });

  it("does not offer download or removal for a soft-removed attachment", async () => {
    await openDetail({
      data: {
        ...ticket,
        attachments: [{
          ...ticket.attachments[0],
          state: "REMOVED",
          removedAt: "2026-09-06T04:00:00.000Z",
          removedByDisplayName: "Anan Chai",
          removalReason: "The evidence is no longer needed.",
        }],
      },
    });

    expect(await screen.findByText("Unavailable for download")).toBeInTheDocument();
    expect(screen.getByText(/Removed .* by Anan Chai/i)).toBeInTheDocument();
    expect(screen.getByText(/Reason: The evidence is no longer needed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
