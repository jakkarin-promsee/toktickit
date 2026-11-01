import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const me = { id: 1, displayName: "Anan Chai", email: "anan@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "a".repeat(64) };
const ticket = { id: "41000000-0000-4000-8000-000000000001", ticketNumber: "TKT-20261004-000001", summary: "VPN connection fails", requestedPriority: "MEDIUM", currentStatus: "OPEN" };

function mockApi() {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input).replace("http://localhost:3000", "");
    let body: unknown = { error: { code: "RESOURCE_NOT_FOUND" } };
    if (url === "/api/auth/me") body = { data: me };
    else if (url.startsWith("/api/tickets")) {
      calls.push(url);
      const params = new URL(url, "http://localhost").searchParams;
      if (params.get("view") === "null") return { ok: false, status: 400, headers: new Headers(), json: async () => ({ error: { message: "Invalid view." } }) };
      const search = params.get("search");
      const page = Number(params.get("page") ?? 1);
      const data = search === "missing" ? [] : [ticket];
      body = { data, pagination: { page, pageSize: 10, totalItems: search === "missing" ? 0 : 11, totalPages: search === "missing" ? 0 : 2, hasPreviousPage: page > 1, hasNextPage: page < 2 } };
    }
    return { ok: body !== undefined, status: 200, headers: new Headers(), json: async () => body };
  }));
  return calls;
}

afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

describe("UI-04 My Tickets search", () => {
  it("loads the default list without sending an empty dashboard view", async () => {
    const calls = mockApi();
    window.history.replaceState({}, "", "/tickets");
    render(<App />);
    expect(await screen.findByRole("link", { name: /VPN connection fails/ })).toBeInTheDocument();
    expect(calls[0]).toBe("/api/tickets?page=1");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("debounces a search, keeps dashboard filters, and restores the query from the URL", async () => {
    const user = userEvent.setup();
    const calls = mockApi();
    window.history.replaceState({}, "", "/tickets?view=open&page=2");
    const app = render(<App />);
    await screen.findByRole("link", { name: /VPN connection fails/ });
    await user.type(screen.getByRole("searchbox", { name: "Search tickets" }), "vpn");
    await waitFor(() => expect(calls.some((url) => url === "/api/tickets?view=open&search=vpn&page=1")).toBe(true), { timeout: 2000 });
    expect(calls.filter((url) => url.includes("search=")).length).toBe(1);
    expect(window.location.search).toBe("?view=open&search=vpn");
    app.unmount();
    render(<App />);
    expect(await screen.findByRole("searchbox", { name: "Search tickets" })).toHaveValue("vpn");
  });

  it("searches from the first page, navigates pages, and clears search with dashboard filters", async () => {
    const user = userEvent.setup();
    const calls = mockApi();
    window.history.replaceState({}, "", "/tickets?view=attention");
    render(<App />);
    await screen.findByRole("link", { name: /VPN connection fails/ });
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(calls.at(-1)).toBe("/api/tickets?view=attention&page=2"));
    expect(window.location.search).toBe("?view=attention&page=2");
    await user.type(screen.getByRole("searchbox", { name: "Search tickets" }), "missing");
    expect(await screen.findByText("No Tickets match this filter.")).toBeInTheDocument();
    expect(window.location.search).toBe("?view=attention&search=missing");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(screen.getByRole("searchbox", { name: "Search tickets" })).toHaveValue("");
  });
});
