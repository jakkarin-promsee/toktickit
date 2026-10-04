import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import { nextStatuses } from "../../src/statusTransitions.js";

const TICKET_ID = "31000000-0000-4000-8000-000000000004";
const staff = { id: 6, displayName: "Narin Support", email: "narin.staff@example.test", role: "IT_STAFF", isActive: true, mustChangePassword: false, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "a".repeat(64) };
const people = [{ id: 6, displayName: "Narin Support", role: "IT_STAFF" }, { id: 7, displayName: "Kanda Service", role: "IT_STAFF" }];

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID, ticketNumber: "TKT-20261004-310004", ticketDate: "2026-10-04T01:00:00.000Z", summary: "Course page stuck", description: "It never loads.",
    requester: { id: 4, displayName: "Pimchanok Dee", role: "REQUESTER" }, category: { id: 3, name: "Software" }, relatedSystem: { id: 4, name: "LEB2 App" },
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", currentStatus: "OPEN", owner: null, requesterResolvedAt: null, requesterResolvedBy: null,
    lastStatusChangedAt: null, lastStatusChangedBy: null, lastOwnerChangedAt: null, lastOwnerChangedBy: null, lastPriorityChangedAt: null, lastPriorityChangedBy: null,
    createdAt: "2026-10-04T01:00:00.000Z", updatedAt: "2026-10-04T02:00:00.000Z", version: 0, attachments: [], publicComments: [], internalNotes: [], ...overrides,
  };
}

type Call = { url: string; method: string; body?: Record<string, unknown> };
type Handler = (call: Call) => { status: number; body: unknown } | undefined;

function mockApi(handler: Handler = () => undefined, initial = detail()) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace("http://localhost:3000", "");
    const call: Call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined };
    calls.push(call);
    const result = handler(call) ?? (url === "/api/auth/me" ? { status: 200, body: { data: staff } }
      : url === "/api/staff/assignees" ? { status: 200, body: { data: people } }
      : url === `/api/staff/tickets/${TICKET_ID}` ? { status: 200, body: { data: initial } }
      : { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Unexpected." } } });
    return { ok: result.status < 400, status: result.status, headers: new Headers(), json: async () => result.body };
  }));
  return calls;
}

function open() {
  window.history.replaceState({}, "", `/staff/tickets/${TICKET_ID}`);
  render(<App />);
}

afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

describe("UNIT-04 client transition helper", () => {
  it("lists targets with owner and confirmation flags", () => {
    expect(nextStatuses("CLOSED")).toEqual([{ to: "REOPENED", ownerRequired: false, confirm: true }]);
    expect(nextStatuses("NEW").map((o) => o.to)).toEqual(["OPEN", "CANCELLED"]);
    expect(nextStatuses("RESOLVED").map((o) => o.to)).toEqual(["CLOSED", "REOPENED"]);
  });
});

describe("UI-06 Staff Ticket Detail", () => {
  it("shows loading then grouped read-only data, workflow cards, and separated communication sections", async () => {
    mockApi();
    open();
    expect(await screen.findByText("Loading ticket…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "TKT-20261004-310004" })).toBeInTheDocument();
    const info = screen.getByLabelText("Ticket information");
    expect(within(info).getByText("Pimchanok Dee")).toBeInTheDocument();
    expect(within(info).getByText("Requested Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Ownership")).toBeInTheDocument();
    expect(screen.getByLabelText("Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Public Comments" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Internal Notes" })).toBeInTheDocument();
    expect(screen.queryByText(/Actions Taken/i)).not.toBeInTheDocument();
  });

  it("claims an unassigned ticket sending the current version", async () => {
    const user = userEvent.setup();
    const calls = mockApi((call) => call.url.endsWith("/claim") ? { status: 200, body: { data: detail({ owner: people[0], version: 1 }) } } : undefined);
    open();
    await user.click(await screen.findByRole("button", { name: "Claim ticket" }));
    expect(await screen.findByText("You now own this Ticket.")).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith("/claim"))!.body).toEqual({ version: 0 });
    expect(screen.queryByRole("button", { name: "Claim ticket" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Narin Support").length).toBeGreaterThan(0);
  });

  it("requires confirmation to reassign and sends the confirmed flag", async () => {
    const user = userEvent.setup();
    const calls = mockApi((call) => call.url.endsWith("/owner") ? { status: 200, body: { data: detail({ owner: people[1], version: 3 }) } } : undefined, detail({ owner: people[0], version: 2 }));
    open();
    await screen.findByRole("heading", { name: "TKT-20261004-310004" });
    await user.selectOptions(screen.getByLabelText("Reassign to"), "7");
    await user.click(screen.getByRole("button", { name: "Reassign" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/from Narin Support to Kanda Service/)).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith("/owner"))).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Ticket assigned to Kanda Service.")).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith("/owner"))!.body).toEqual({ ownerId: 7, confirmed: true, version: 2 });
  });

  it("keeps Requested Priority read-only and saves only IT Priority", async () => {
    const user = userEvent.setup();
    const calls = mockApi((call) => call.url.endsWith("/it-priority") ? { status: 200, body: { data: detail({ itPriority: "HIGH", version: 1 }) } } : undefined);
    open();
    await screen.findByRole("heading", { name: "TKT-20261004-310004" });
    expect(screen.getByText(/Requested Priority \(read-only\)/)).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save IT Priority" });
    expect(save).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
    await user.click(save);
    expect(await screen.findByText("IT Priority saved.")).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith("/it-priority"))!.body).toEqual({ itPriority: "HIGH", version: 0 });
  });

  it("offers only matrix transitions, blocks owner-required ones without an owner, and confirms destructive ones", async () => {
    const user = userEvent.setup();
    const calls = mockApi((call) => call.url.endsWith("/status") ? { status: 200, body: { data: detail({ currentStatus: "CANCELLED", version: 1 }) } } : undefined);
    open();
    await screen.findByRole("heading", { name: "TKT-20261004-310004" });
    expect(screen.getByRole("button", { name: "Move to In Progress" })).toBeDisabled();
    expect(screen.getAllByText("Assign an owner first").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Move to Resolved" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move to Closed" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move to Cancelled" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/from Open to Cancelled/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Status changed to Cancelled.")).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith("/status"))!.body).toEqual({ status: "CANCELLED", confirmed: true, version: 0 });
  });

  it("shows a stale conflict with Refresh and keeps drafts intact", async () => {
    const user = userEvent.setup();
    mockApi((call) => call.url.endsWith("/it-priority") ? { status: 409, body: { error: { code: "STALE_TICKET", message: "This Ticket changed." } } } : undefined);
    open();
    await screen.findByRole("heading", { name: "TKT-20261004-310004" });
    await user.type(screen.getByLabelText("Add public comment"), "Draft in progress");
    await user.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
    await user.click(screen.getByRole("button", { name: "Save IT Priority" }));
    expect((await screen.findAllByText("This Ticket changed. Refresh before trying again.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.getByLabelText("Add public comment")).toHaveValue("Draft in progress");
    expect(screen.getByLabelText("IT Priority")).toHaveValue("HIGH");
  });

  it("separates Public Comments from Internal Notes, with warnings and independent drafts", async () => {
    const user = userEvent.setup();
    mockApi((call) => call.url.endsWith("/internal-notes") && call.method === "POST" ? { status: 201, body: { data: { id: "n1", content: "<b>private</b> note", author: { id: 6, displayName: "Narin Support" }, createdAt: "2026-10-04T03:00:00.000Z" } } } : undefined, detail({ publicComments: [{ id: "c1", content: "Public hello", author: { id: 6, displayName: "Narin Support" }, createdAt: "2026-10-04T02:00:00.000Z" }], internalNotes: [{ id: "n0", content: "Existing secret", author: { id: 6, displayName: "Narin Support" }, createdAt: "2026-10-04T02:30:00.000Z" }] }));
    open();
    await screen.findByRole("heading", { name: "TKT-20261004-310004" });
    expect(screen.getByText("Public hello")).toBeInTheDocument();
    expect(screen.queryByText("Existing secret")).not.toBeInTheDocument();
    expect(screen.getByText(/the requester will see this comment/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Add public comment"), "public draft");
    await user.click(screen.getByRole("tab", { name: "Internal Notes" }));
    expect(screen.getByText(/Visible only to IT Staff and Administrators/)).toBeInTheDocument();
    expect(screen.getByText("Existing secret")).toBeInTheDocument();
    expect(screen.getByLabelText("Add internal note")).toHaveValue("");
    expect(screen.queryByLabelText("Add public comment")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Add internal note"), "<b>private</b> note");
    await user.click(screen.getByRole("button", { name: "Save internal note" }));
    expect(await screen.findByText("Internal note saved.")).toBeInTheDocument();
    expect(screen.getByText("<b>private</b> note")).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Public Comments" }));
    expect(screen.getByLabelText("Add public comment")).toHaveValue("public draft");
    expect(screen.queryByText("<b>private</b> note")).not.toBeInTheDocument();
  });

  it("validates empty comments and notes locally and keeps the draft after a server failure", async () => {
    const user = userEvent.setup();
    const calls = mockApi((call) => call.url.endsWith("/comments") && call.method === "POST" ? { status: 503, body: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Tickets are temporarily unavailable." } } } : undefined);
    open();
    await screen.findByRole("heading", { name: "TKT-20261004-310004" });
    await user.click(screen.getByRole("button", { name: "Post public comment" }));
    expect(screen.getByText("Comment is required.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Internal Notes" }));
    await user.click(screen.getByRole("button", { name: "Save internal note" }));
    expect(screen.getByText("Note is required.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    await user.click(screen.getByRole("tab", { name: "Public Comments" }));
    await user.type(screen.getByLabelText("Add public comment"), "Will fail");
    await user.click(screen.getByRole("button", { name: "Post public comment" }));
    expect(await screen.findByText("Tickets are temporarily unavailable.")).toBeInTheDocument();
    expect(screen.getByLabelText("Add public comment")).toHaveValue("Will fail");
  });

  it("lists existing attachments with download links and no upload or remove controls", async () => {
    const user = userEvent.setup();
    mockApi(undefined, detail({ attachments: [{ id: "a1", originalName: "screenshot.png", mimeType: "image/png", sizeBytes: 10, state: "ACTIVE", uploadedByDisplayName: "Pimchanok Dee", createdAt: "2026-10-04T01:00:00.000Z", removedAt: null, removedByDisplayName: null, removalReason: null }] }));
    open();
    await screen.findByRole("heading", { name: "TKT-20261004-310004" });
    await user.click(screen.getByRole("tab", { name: "Attachments" }));
    expect(screen.getByRole("link", { name: "screenshot.png" })).toHaveAttribute("href", expect.stringContaining("/api/attachments/a1/download"));
    expect(screen.queryByRole("button", { name: /upload|remove/i })).not.toBeInTheDocument();
  });

  it("shows safe not-found, forbidden, and failure-with-retry states", async () => {
    const user = userEvent.setup();
    mockApi((call) => call.url === `/api/staff/tickets/${TICKET_ID}` ? { status: 404, body: { error: { code: "RESOURCE_NOT_FOUND", message: "Ticket was not found." } } } : undefined);
    const first = render(<App />);
    first.unmount();
    window.history.replaceState({}, "", `/staff/tickets/${TICKET_ID}`);
    const { unmount } = render(<App />);
    expect(await screen.findByText("We couldn't find this ticket.")).toBeInTheDocument();
    unmount();
    mockApi((call) => call.url === `/api/staff/tickets/${TICKET_ID}` ? { status: 403, body: { error: { code: "FORBIDDEN" } } } : undefined);
    const second = render(<App />);
    expect(await screen.findByText(/Forbidden\. Your account is not permitted/)).toBeInTheDocument();
    second.unmount();
    let calls = 0;
    mockApi((call) => { if (call.url !== `/api/staff/tickets/${TICKET_ID}`) return undefined; calls += 1; return calls === 1 ? { status: 503, body: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Tickets are temporarily unavailable." } } } : { status: 200, body: { data: detail() } }; });
    render(<App />);
    expect(await screen.findByText(/Tickets are temporarily unavailable\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "TKT-20261004-310004" })).toBeInTheDocument();
  });
});
