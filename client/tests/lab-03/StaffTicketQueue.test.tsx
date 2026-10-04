import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import { parseQueueSearch } from "../../src/StaffTicketQueue.js";

const staff = { id: 6, displayName: "Narin Support", email: "narin.staff@example.test", role: "IT_STAFF", isActive: true, mustChangePassword: false, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "a".repeat(64) };
const TICKET_ID = "31000000-0000-4000-8000-000000000004";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID, ticketNumber: "TKT-20261004-310004", summary: "Course page stuck", requester: { id: 4, displayName: "Pimchanok Dee" },
    category: { id: 3, name: "Software" }, relatedSystem: { id: 4, name: "LEB2 App" }, requestedPriority: "MEDIUM", itPriority: "HIGH",
    currentStatus: "WAITING_FOR_REQUESTER", owner: null, requesterResolvedAt: null, createdAt: "2026-10-04T01:00:00.000Z", updatedAt: "2026-10-04T02:00:00.000Z", version: 0, ...overrides,
  };
}

function page(data: unknown[], overrides: Record<string, unknown> = {}) {
  const totalItems = (overrides.totalItems as number) ?? data.length;
  return { data, pagination: { page: 1, pageSize: 20, totalItems, totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / 20), hasPreviousPage: false, hasNextPage: totalItems > 20, ...(overrides.pagination as object) }, counts: { total: 8, unassigned: 2, mine: 3, ...(overrides.counts as object) } };
}

type Handler = (search: string) => { status: number; body: unknown };

function mockApi(handler: Handler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input).replace("http://localhost:3000", "");
    let result: { status: number; body: unknown } = { status: 404, body: { error: { code: "RESOURCE_NOT_FOUND" } } };
    if (url === "/api/auth/me") result = { status: 200, body: { data: staff } };
    else if (url === "/api/categories") result = { status: 200, body: [{ id: 3, name: "Software" }] };
    else if (url === "/api/related-systems") result = { status: 200, body: [{ id: 4, name: "LEB2 App" }] };
    else if (url.startsWith("/api/staff/tickets")) result = handler(url.slice("/api/staff/tickets".length));
    return { ok: result.status < 400, status: result.status, headers: new Headers(), json: async () => result.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const queueCalls = (fetchMock: ReturnType<typeof mockApi>) => fetchMock.mock.calls.map(([url]) => String(url).replace("http://localhost:3000", "")).filter((url) => url.startsWith("/api/staff/tickets")).map((url) => url.slice("/api/staff/tickets".length));

afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

describe("UI-05 URL state parsing", () => {
  it("restores valid values and resets invalid, duplicate, or unknown ones", () => {
    expect(parseQueueSearch("?status=OPEN&owner=me&page=2&pageSize=10&sortBy=status&sortOrder=asc").state).toMatchObject({ status: "OPEN", owner: "me", page: "2", pageSize: "10", sortBy: "status", sortOrder: "asc" });
    for (const bad of ["?status=DONE", "?page=0", "?pageSize=15", "?owner=bob", "?foo=1", "?status=OPEN&status=NEW"]) {
      const result = parseQueueSearch(bad);
      expect(result.reset, bad).toBe(true);
      expect(result.state.status).toBe("");
      expect(result.state.page).toBe("1");
    }
  });
});

describe("UI-05 Staff Ticket Queue", () => {
  it("shows loading, then counts, table and card data with owner, badges, and a View link", async () => {
    window.history.replaceState({}, "", "/staff/tickets");
    mockApi(() => ({ status: 200, body: page([row(), row({ id: "31000000-0000-4000-8000-000000000005", ticketNumber: "TKT-20261004-310005", summary: "VPN fixed", owner: { id: 6, displayName: "Narin Support", role: "IT_STAFF" }, currentStatus: "OPEN" })]) }));
    render(<App />);
    expect(await screen.findByText("Loading tickets…")).toBeInTheDocument();
    expect(await screen.findByRole("table")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Course page stuck")).toBeInTheDocument();
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();
    expect(within(table).getByText("Narin Support")).toBeInTheDocument();
    expect(within(table).getAllByText("Requested: Medium").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("IT: High").length).toBeGreaterThan(0);
    expect(within(table).getByText("Waiting for Requester")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–2 of 2")).toBeInTheDocument();
    const summary = screen.getByLabelText("Queue summary");
    expect(within(summary).getByText("8")).toBeInTheDocument();
    expect(within(summary).getByText("2")).toBeInTheDocument();
    expect(within(summary).getByText("3")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View TKT-20261004-310004" })[0]).toHaveAttribute("href", `/staff/tickets/${TICKET_ID}`);
    expect(screen.getAllByText("TKT-20261004-310004").length).toBe(2);
  });

  it("debounces search, resets to page 1, and reflects state in the URL", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/staff/tickets?page=2");
    const fetchMock = mockApi(() => ({ status: 200, body: page([row()]) }));
    render(<App />);
    await screen.findByRole("table");
    await user.type(screen.getByLabelText("Search tickets"), "vpn");
    await waitFor(() => expect(queueCalls(fetchMock).some((url) => url === "?search=vpn")).toBe(true), { timeout: 2000 });
    expect(queueCalls(fetchMock).filter((url) => url.includes("search=")).length).toBe(1);
    expect(window.location.search).toBe("?search=vpn");
  });

  it("applies filters, sort, and page size to the API query and clears them", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/staff/tickets");
    const fetchMock = mockApi(() => ({ status: 200, body: page([row()]) }));
    render(<App />);
    await screen.findByRole("table");
    await user.selectOptions(screen.getByLabelText("Status"), "OPEN");
    await user.selectOptions(screen.getByLabelText("Owner"), "unassigned");
    await user.selectOptions(screen.getByLabelText("Sort by"), "ticketNumber");
    await user.selectOptions(screen.getByLabelText("Direction"), "asc");
    await user.selectOptions(screen.getByLabelText("Page size"), "10");
    await waitFor(() => expect(queueCalls(fetchMock).at(-1)).toBe("?status=OPEN&owner=unassigned&sortBy=ticketNumber&sortOrder=asc&pageSize=10"));
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(queueCalls(fetchMock).at(-1)).toBe("?sortBy=ticketNumber&sortOrder=asc&pageSize=10"));
    expect(screen.getByLabelText("Status")).toHaveValue("");
  });

  it("pages forward and back with accurate controls", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/staff/tickets");
    const fetchMock = mockApi((search) => search.includes("page=2")
      ? { status: 200, body: page([row()], { totalItems: 25, pagination: { page: 2, hasPreviousPage: true, hasNextPage: false, totalPages: 2 } }) }
      : { status: 200, body: page([row()], { totalItems: 25, pagination: { totalPages: 2, hasNextPage: true } }) });
    render(<App />);
    await screen.findByText("Page 1 of 2");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
    expect(queueCalls(fetchMock).at(-1)).toBe("?page=2");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("restores URL state on load and resets an invalid one with a message", async () => {
    window.history.replaceState({}, "", "/staff/tickets?status=OPEN&owner=me");
    const fetchMock = mockApi(() => ({ status: 200, body: page([row()]) }));
    const { unmount } = render(<App />);
    await screen.findByRole("table");
    expect(screen.getByLabelText("Status")).toHaveValue("OPEN");
    expect(queueCalls(fetchMock)[0]).toBe("?status=OPEN&owner=me");
    unmount();
    window.history.replaceState({}, "", "/staff/tickets?status=BOGUS");
    const second = mockApi(() => ({ status: 200, body: page([row()]) }));
    render(<App />);
    expect(await screen.findByText(/were not valid, so the queue was reset/)).toBeInTheDocument();
    expect(queueCalls(second)[0]).toBe("");
  });

  it("distinguishes the empty database from no results", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/staff/tickets");
    mockApi(() => ({ status: 200, body: page([], { counts: { total: 0, unassigned: 0, mine: 0 } }) }));
    const { unmount } = render(<App />);
    expect(await screen.findByText(/No tickets exist yet/)).toBeInTheDocument();
    unmount();
    mockApi(() => ({ status: 200, body: page([]) }));
    window.history.replaceState({}, "", "/staff/tickets?status=OPEN");
    render(<App />);
    expect(await screen.findByText("No tickets match")).toBeInTheDocument();
    expect(screen.queryByText(/No tickets exist yet/)).not.toBeInTheDocument();
    await user.click(within(screen.getByText("No tickets match").parentElement as HTMLElement).getByRole("button", { name: "Clear filters" }));
    expect(screen.getByLabelText("Status")).toHaveValue("");
  });

  it("shows a forbidden state without ticket data", async () => {
    window.history.replaceState({}, "", "/staff/tickets");
    mockApi(() => ({ status: 403, body: { error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } } }));
    render(<App />);
    expect(await screen.findByText(/Forbidden\. Your account is not permitted/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows a safe failure that keeps filters and retries", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/staff/tickets?status=OPEN");
    let calls = 0;
    mockApi(() => { calls += 1; return calls === 1 ? { status: 503, body: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Tickets are temporarily unavailable." } } } : { status: 200, body: page([row()]) }; });
    render(<App />);
    expect(await screen.findByText(/Tickets could not be loaded/)).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("OPEN");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("opens the Ticket Detail boundary without mutation controls", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/staff/tickets");
    mockApi(() => ({ status: 200, body: page([row()]) }));
    render(<App />);
    await screen.findByRole("table");
    await user.click(screen.getAllByRole("link", { name: "View TKT-20261004-310004" })[0]);
    expect(window.location.pathname).toBe(`/staff/tickets/${TICKET_ID}`);
    expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /claim|assign|resolve/i })).not.toBeInTheDocument();
  });
});
