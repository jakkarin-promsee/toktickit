import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaffDashboard } from "../../src/Dashboards.js";

afterEach(() => vi.restoreAllMocks());
describe("Staff Dashboard", () => {
  it("links counts, buckets, urgent tickets and current-user actions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { asOf: "2026-10-31T10:00:00.000Z", windowStart: "2026-10-25T00:00:00.000Z", cards: { unassignedTickets: 0, myTickets: 1, myActiveActions: 2 }, byStatus: { NEW: 1, OPEN: 0, IN_PROGRESS: 0, WAITING_FOR_REQUESTER: 0, RESOLVED: 0, CLOSED: 0, REOPENED: 0, CANCELLED: 0 }, byItPriority: { LOW: 0, MEDIUM: 0, HIGH: 1 }, recentTickets: [], urgentTickets: [{ id: "t", ticketNumber: "TKT-1", summary: "Outage", currentStatus: "NEW", itPriority: "HIGH", updatedAt: "2026-10-31T09:00:00.000Z" }], myActions: [{ id: "a", ticketId: "t", ticketNumber: "TKT-1", description: "Investigate", status: "PLANNED", actionAt: "2026-11-01T00:00:00.000Z" }] } }) }));
    render(<StaffDashboard onOpen={(event) => event.preventDefault()} />);
    expect(await screen.findByRole("link", { name: "View my active actions" })).toHaveAttribute("href", "/staff/tickets?view=my-active-actions");
    expect(screen.getByRole("link", { name: "Open: 0" })).toHaveAttribute("href", "/staff/tickets?status=OPEN");
    expect(screen.getByRole("link", { name: /Investigate/ })).toHaveAttribute("href", "/staff/tickets/t#action-a");
    expect(screen.getByRole("link", { name: "View all urgent tickets" })).toHaveAttribute("href", "/staff/tickets?view=urgent");
    expect(screen.getByText(/No Tickets updated in the last seven UTC days/)).toBeInTheDocument();
  });
  it("shows forbidden feedback without counts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, headers: new Headers(), json: async () => ({ error: { message: "Forbidden" } }) }));
    render(<StaffDashboard onOpen={(event) => event.preventDefault()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("do not have access");
    expect(screen.queryByRole("link", { name: /View my tickets/ })).not.toBeInTheDocument();
  });
  it("shows a safe API failure without retaining metrics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, headers: new Headers(), json: async () => ({ error: { code: "DEPENDENCY_UNAVAILABLE" } }) }));
    render(<StaffDashboard onOpen={(event) => event.preventDefault()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Dashboard could not be loaded");
    expect(screen.queryByRole("link", { name: "View my tickets" })).not.toBeInTheDocument();
  });
});
