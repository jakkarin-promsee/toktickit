import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequesterDashboard } from "../../src/Dashboards.js";

const date = "2026-10-31T10:00:00.000Z";
afterEach(() => vi.restoreAllMocks());

describe("Requester Dashboard", () => {
  it("shows zero cards, owned summary rows and fixed UTC drill-down links", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { asOf: date, windowStart: "2026-10-25T00:00:00.000Z", cards: { openTickets: 0, waitingForYou: 1, recentlyUpdated: 1, recentlyResolved: 0 }, recentTickets: [{ id: "a", ticketNumber: "TKT-1", summary: "Printer", currentStatus: "OPEN", updatedAt: date }], attentionTickets: [] } }) }));
    render(<RequesterDashboard onOpen={(event) => event.preventDefault()} />);
    expect(await screen.findByRole("link", { name: "View recently updated" })).toHaveAttribute("href", `/tickets?view=recent-updated&from=2026-10-25T00%3A00%3A00.000Z&through=2026-10-31T10%3A00%3A00.000Z`);
    expect(screen.getByRole("link", { name: "View open tickets" })).toHaveAttribute("href", "/tickets?view=open");
    expect(screen.getByRole("link", { name: /TKT-1/ })).toHaveAttribute("href", "/tickets/a");
    expect(screen.getByRole("link", { name: "View all recent tickets" })).toHaveAttribute("href", `/tickets?view=recent-updated&from=2026-10-25T00%3A00%3A00.000Z&through=2026-10-31T10%3A00%3A00.000Z`);
    expect(screen.getByText(/No Tickets need your attention/)).toBeInTheDocument();
  });
  it("hides counts when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: { message: "outage" } }) }));
    render(<RequesterDashboard onOpen={(event) => event.preventDefault()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Dashboard could not be loaded");
    expect(screen.queryByRole("link", { name: /View open tickets/ })).not.toBeInTheDocument();
  });
  it("treats an incomplete 200 response as a safe failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), json: async () => ({ data: { cards: { openTickets: 8 } } }) }));
    render(<RequesterDashboard onOpen={(event) => event.preventDefault()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Dashboard could not be loaded");
    expect(screen.queryByText("8")).not.toBeInTheDocument();
  });
  it("shows a role-safe forbidden state without counts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, headers: new Headers(), json: async () => ({ error: { code: "FORBIDDEN" } }) }));
    render(<RequesterDashboard onOpen={(event) => event.preventDefault()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("do not have access");
    expect(screen.queryByRole("link", { name: "View open tickets" })).not.toBeInTheDocument();
  });
});
