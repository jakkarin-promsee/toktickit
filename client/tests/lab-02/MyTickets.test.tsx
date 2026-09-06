import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
  summary: "Laptop battery drains quickly",
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 7, name: "Corporate Laptop" },
  requestedPriority: "MEDIUM",
  itPriority: "UNASSIGNED",
  currentStatus: "NEW",
  createdAt: "2026-09-06T03:12:00.000Z",
  updatedAt: "2026-09-06T03:12:00.000Z",
};

function setupFetch(ticketResponse: unknown = {
  data: [ticket],
  pagination: {
    page: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
}) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.endsWith("/api/requesters")) {
      return Promise.resolve(response({
        data: [
          { id: 1, displayName: "Anan Chai", email: "anan@example.test" },
        { id: 2, displayName: "Mali Srisuk", email: "mali@example.test" },
        ],
      }));
    }
    if (url.endsWith("/api/categories")) return Promise.resolve(response([{ id: 2, name: "Hardware" }]));
    if (url.endsWith("/api/related-systems")) {
      return Promise.resolve(response([{ id: 7, name: "Corporate Laptop" }]));
    }
    if (url.includes("/api/tickets")) return Promise.resolve(response(ticketResponse));
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

async function openMyTickets(ticketResponse?: unknown) {
  localStorage.setItem("toktickit.requesterId", "1");
  const fetch = setupFetch(ticketResponse);
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "My Tickets" });
  if (ticketResponse === undefined) {
    await waitFor(() =>
      expect(screen.getAllByText(ticket.ticketNumber).length).toBeGreaterThan(0),
    );
  }
  return { user, fetch };
}

describe("My Tickets", () => {
  it("renders search, filters, sort, pagination, and a desktop table", async () => {
    await openMyTickets();

    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Related System")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Requested Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort by")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveTextContent(ticket.ticketNumber);
    expect(screen.getAllByRole("link", { name: "View ticket" }).length).toBeGreaterThan(0);
  });

  it("resets page when search changes and sends the selected query", async () => {
    const { user, fetch } = await openMyTickets();
    await user.type(screen.getByLabelText("Search"), "battery");

    await waitFor(() => {
      expect(fetch.mock.calls.some(([url]) => String(url).includes("search=battery"))).toBe(true);
    }, { timeout: 1000 });
    expect(fetch.mock.calls.some(([url]) => String(url).includes("page=1"))).toBe(true);
  });

  it("sends selected filters and sorting to the API", async () => {
    const { user, fetch } = await openMyTickets();
    await user.selectOptions(screen.getByLabelText("Category"), "2");
    await user.selectOptions(screen.getByLabelText("Related System"), "7");
    await user.selectOptions(screen.getByLabelText("Status"), "NEW");
    await user.selectOptions(screen.getByLabelText("Requested Priority"), "HIGH");
    await user.selectOptions(screen.getByLabelText("Sort by"), "summary");
    await user.selectOptions(screen.getByLabelText("Sort order"), "asc");

    await waitFor(() => {
      const urls = fetch.mock.calls.map(([url]) => String(url));
      expect(urls.some((url) =>
        url.includes("categoryId=2") &&
        url.includes("relatedSystemId=7") &&
        url.includes("status=NEW") &&
        url.includes("requestedPriority=HIGH") &&
        url.includes("sortBy=summary") &&
        url.includes("sortOrder=asc") &&
        url.includes("page=1"),
      )).toBe(true);
    }, { timeout: 1500 });
  });

  it("distinguishes an empty list from a filtered no-results list", async () => {
    const { user } = await openMyTickets({
      data: [],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });
    await waitFor(() => expect(screen.getByText("You have no tickets yet.")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Search"), "missing");
    await waitFor(() => {
      expect(screen.getByText("No tickets match your search and filters.")).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it("shows a safe failure state and keeps the current criteria", async () => {
    const { user } = await openMyTickets(new Error("database secret"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't load your tickets/i),
    );

    await user.type(screen.getByLabelText("Search"), "laptop");
    expect(screen.getByLabelText("Search")).toHaveValue("laptop");
    expect(screen.queryByText(/database secret/i)).not.toBeInTheDocument();
  });

  it("restores supported query state from the URL", async () => {
    window.history.replaceState(null, "", "/?search=restored&pageSize=20");
    await openMyTickets();

    expect(screen.getByLabelText("Search")).toHaveValue("restored");
    expect(screen.getByLabelText("Tickets per page")).toHaveValue("20");
  });

  it("reloads the list with the new Requester context", async () => {
    const { user, fetch } = await openMyTickets();
    await user.click(screen.getByRole("button", { name: "Change Requester" }));
    await user.selectOptions(
      screen.getByLabelText("Development Requester"),
      "2",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(
        fetch.mock.calls.some(
          ([url, options]) =>
            String(url).includes("/api/tickets") &&
            (options as RequestInit)?.headers &&
            (options as RequestInit).headers &&
            (options as RequestInit).headers instanceof Object &&
            (options as RequestInit).headers &&
            (options as { headers: Record<string, string> }).headers["X-Requester-Id"] === "2",
        ),
      ).toBe(true);
    });
  });
});
