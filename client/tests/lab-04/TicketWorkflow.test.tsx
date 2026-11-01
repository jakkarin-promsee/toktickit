import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StaffTicketDetail } from "../../src/StaffTicketDetail.js";

const id = "31000000-0000-4000-8000-000000000060";
const staff = { id: 6, displayName: "Narin Support", email: "narin.staff@example.test", role: "IT_STAFF" as const, isActive: true as const, mustChangePassword: false, sessionExpiresAt: "2026-10-31T08:00:00.000Z", csrfToken: "a".repeat(64) };
const owner = { id: 6, displayName: "Narin Support", role: "IT_STAFF" as const };
const detail = (status = "IN_PROGRESS", version = 0) => ({ id, ticketNumber: "TKT-20261031-000060", summary: "Repair", description: "Needs work", requester: { id: 1, displayName: "Anan", role: "REQUESTER" }, category: { id: 1, name: "Software" }, relatedSystem: { id: 1, name: "Web" }, requestedPriority: "LOW", itPriority: "LOW", currentStatus: status, owner, requesterResolvedAt: null, requesterResolvedBy: null, lastStatusChangedAt: null, lastStatusChangedBy: null, lastOwnerChangedAt: null, lastOwnerChangedBy: null, lastPriorityChangedAt: null, lastPriorityChangedBy: null, createdAt: "2026-10-31T01:00:00.000Z", updatedAt: "2026-10-31T01:00:00.000Z", version, attachments: [], publicComments: [], internalNotes: [] });
type Reply = { status: number; data?: unknown; code?: string; message?: string };

function api(statusReply: Reply) {
  const calls: { url: string; body?: Record<string, unknown> }[] = [];
  let current = detail();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace("http://localhost:3000", "");
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, body });
    let reply: Reply = { status: 200, data: current };
    if (url.endsWith("/status")) { reply = statusReply; if (reply.status === 200) current = reply.data as typeof current; }
    else if (url.endsWith("/workflow-events") || url.endsWith("/actions") || url.endsWith("/assignees")) reply = { status: 200, data: [] };
    return { ok: reply.status < 400, status: reply.status, headers: new Headers(), json: async () => reply.status < 400 ? { data: reply.data } : { error: { code: reply.code, message: reply.message } } };
  }));
  render(<StaffTicketDetail ticketId={id} user={staff} onBack={(event) => event.preventDefault()} />);
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe("Ticket workflow UI", () => {
  it("shows a blocked resolution with a link to Actions Taken and preserves the current status", async () => {
    const user = userEvent.setup();
    const calls = api({ status: 409, code: "RESOLUTION_ACTION_REQUIRED", message: "Complete an action for this Ticket before resolving it." });
    await user.click(await screen.findByRole("button", { name: "Move to Resolved" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("link", { name: "View Actions Taken" })).toHaveAttribute("href", "#actions-taken");
    expect(within(screen.getByLabelText("Status")).getByText("In Progress")).toBeInTheDocument();
    expect(calls.find((call) => call.url.endsWith("/status"))?.body).toEqual({ status: "RESOLVED", version: 0, confirmed: true });
  });

  it("refreshes status after a successful transition", async () => {
    const user = userEvent.setup();
    api({ status: 200, data: detail("RESOLVED", 1) });
    await user.click(await screen.findByRole("button", { name: "Move to Resolved" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("Status changed to Resolved.")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Status")).getByText("Resolved")).toBeInTheDocument();
  });

  it("shows refresh on stale conflict and keeps existing draft text", async () => {
    const user = userEvent.setup();
    api({ status: 409, code: "STALE_TICKET", message: "This Ticket changed." });
    await user.type(await screen.findByLabelText("Add public comment"), "Keep my draft");
    await user.click(screen.getByRole("button", { name: "Move to Waiting for Requester" }));
    expect(await screen.findByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.getByLabelText("Add public comment")).toHaveValue("Keep my draft");
  });
});
