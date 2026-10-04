import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const TICKET_ID = "31000000-0000-4000-8000-000000000004";
const me = { id: 1, displayName: "Anan Chai", email: "anan@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "a".repeat(64) };

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID, ticketNumber: "TKT-20261004-310004", ticketDate: "2026-10-04T01:00:00.000Z", requester: { id: 1, displayName: "Anan Chai" },
    category: { id: 1, name: "Software" }, relatedSystem: { id: 4, name: "LEB2 App" }, summary: "Course page stuck", requestedPriority: "MEDIUM", itPriority: "MEDIUM",
    currentStatus: "WAITING_FOR_REQUESTER", description: "It never loads.", requesterResolvedAt: null, version: 2, createdAt: "2026-10-04T01:00:00.000Z", updatedAt: "2026-10-04T01:00:00.000Z",
    attachments: [], ...overrides,
  };
}

type Handler = (url: string, init?: RequestInit) => { status: number; body: unknown } | undefined;

function mockApi(handler: Handler, comments: unknown[] = []) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace("http://localhost:3000", "");
    const custom = handler(url, init);
    const result = custom ?? (url === "/api/auth/me" ? { status: 200, body: { data: me } }
      : url === `/api/tickets/${TICKET_ID}` ? { status: 200, body: { data: ticket() } }
      : url === `/api/tickets/${TICKET_ID}/comments` && !init?.method ? { status: 200, body: { data: comments } }
      : { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Unexpected." } } });
    return { ok: result.status < 400, status: result.status, headers: new Headers(), json: async () => result.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function open() {
  window.history.replaceState({}, "", `/tickets/${TICKET_ID}`);
  render(<App />);
}

afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

describe("UI-04 Requester Ticket Detail", () => {
  it("shows loading, then the ticket, an empty comments state, and no Internal Note or staff controls", async () => {
    mockApi(() => undefined);
    open();
    expect(await screen.findByText("Loading ticket…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Course page stuck" })).toBeInTheDocument();
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
    expect(screen.queryByText(/internal note/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/IT Priority/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Change Requester/i)).not.toBeInTheDocument();
  });

  it("renders comment content as inert plain text", async () => {
    const markup = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    mockApi(() => undefined, [{ id: "c1", content: markup, author: { id: 9, displayName: "Narin Support" }, createdAt: "2026-10-04T02:00:00.000Z" }]);
    open();
    expect(await screen.findByText(markup)).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });

  it("validates empty and over-limit comments without calling the API, then posts a valid one", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi((url, init) => init?.method === "POST" && url.endsWith("/comments") ? { status: 201, body: { data: { id: "c2", content: "Still failing", author: { id: 1, displayName: "Anan Chai" }, createdAt: "2026-10-04T03:00:00.000Z" } } } : undefined);
    open();
    await screen.findByRole("heading", { name: "Course page stuck" });
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText("Comment is required.")).toBeInTheDocument();
    const box = screen.getByLabelText("Add public comment");
    await user.type(box, "   ");
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(screen.getByText("Comment is required.")).toBeInTheDocument();
    await user.clear(box);
    await user.click(box);
    await user.paste("x".repeat(2001));
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText("Comment must contain 2000 characters or fewer.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(false);
    await user.clear(box);
    await user.type(box, "Still failing");
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText("Comment posted.")).toBeInTheDocument();
    expect(screen.getByText("Still failing")).toBeInTheDocument();
    expect(box).toHaveValue("");
  });

  it("keeps the draft and shows a safe failure when posting fails", async () => {
    const user = userEvent.setup();
    mockApi((url, init) => init?.method === "POST" && url.endsWith("/comments") ? { status: 503, body: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Tickets are temporarily unavailable." } } } : undefined);
    open();
    await screen.findByRole("heading", { name: "Course page stuck" });
    await user.type(screen.getByLabelText("Add public comment"), "Draft text");
    await user.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText("Tickets are temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByLabelText("Add public comment")).toHaveValue("Draft text");
  });

  it("confirms Problem Appears Resolved, records it, and keeps the status unchanged", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi((url, init) => url.endsWith("/problem-appears-resolved") && init?.method === "POST" ? { status: 200, body: { data: ticket({ requesterResolvedAt: "2026-10-04T04:00:00.000Z", version: 3 }) } } : undefined);
    open();
    await screen.findByRole("heading", { name: "Course page stuck" });
    await user.click(screen.getByRole("button", { name: "Problem appears resolved" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/support must still resolve or close the Ticket/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/You indicated the problem appears resolved/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Problem appears resolved" })).not.toBeInTheDocument();
    expect(screen.getByText("Waiting for Requester")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/problem-appears-resolved"))!;
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ version: 2 });
  });

  it("can cancel the confirmation and reports a conflict safely", async () => {
    const user = userEvent.setup();
    mockApi((url, init) => url.endsWith("/problem-appears-resolved") && init?.method === "POST" ? { status: 409, body: { error: { code: "STALE_TICKET", message: "This Ticket changed. Refresh and try again." } } } : undefined);
    open();
    await screen.findByRole("heading", { name: "Course page stuck" });
    await user.click(screen.getByRole("button", { name: "Problem appears resolved" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Problem appears resolved" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("This Ticket changed. Refresh and try again.")).toBeInTheDocument();
  });

  it("hides the action outside Waiting for Requester", async () => {
    mockApi((url) => url === `/api/tickets/${TICKET_ID}` ? { status: 200, body: { data: ticket({ currentStatus: "IN_PROGRESS" }) } } : undefined);
    open();
    await screen.findByRole("heading", { name: "Course page stuck" });
    expect(screen.queryByRole("button", { name: "Problem appears resolved" })).not.toBeInTheDocument();
  });

  it("shows a safe not-found message for an unowned ticket and a retry on failure", async () => {
    const user = userEvent.setup();
    let calls = 0;
    mockApi((url) => {
      if (url === `/api/tickets/${TICKET_ID}`) { calls += 1; return calls === 1 ? { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Ticket could not be loaded. Please try again." } } } : { status: 404, body: { error: { code: "RESOURCE_NOT_FOUND", message: "Ticket was not found." } } }; }
      if (url.endsWith("/comments")) return { status: 404, body: { error: { code: "RESOURCE_NOT_FOUND", message: "Ticket was not found." } } };
      return undefined;
    });
    open();
    expect(await screen.findByText("Ticket could not be loaded. Please try again.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("We couldn't find this ticket.")).toBeInTheDocument());
  });
});

describe("UI-04 My Tickets", () => {
  it("lists only the tickets returned for the session and links to detail", async () => {
    mockApi((url) => url.startsWith("/api/tickets?") || url === "/api/tickets" ? { status: 200, body: { data: [{ id: TICKET_ID, ticketNumber: "TKT-20261004-310004", summary: "Course page stuck", category: { id: 1, name: "Software" }, relatedSystem: { id: 4, name: "LEB2 App" }, requestedPriority: "MEDIUM", itPriority: "MEDIUM", currentStatus: "WAITING_FOR_REQUESTER", createdAt: "2026-10-04T01:00:00.000Z", updatedAt: "2026-10-04T01:00:00.000Z" }], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false } } } : undefined);
    window.history.replaceState({}, "", "/tickets");
    render(<App />);
    const link = await screen.findByRole("link", { name: /Course page stuck/ });
    expect(link).toHaveAttribute("href", `/tickets/${TICKET_ID}`);
    expect(screen.queryByText(/Change Requester/i)).not.toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mockApi((url) => url.startsWith("/api/tickets") ? { status: 200, body: { data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } } } : undefined);
    window.history.replaceState({}, "", "/tickets");
    render(<App />);
    expect(await screen.findByText("You have not submitted any tickets yet.")).toBeInTheDocument();
  });
});
