import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

const user = (role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", mustChangePassword = false) => ({ id: 1, displayName: "Role User", email: "role@example.test", role, isActive: true, mustChangePassword, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "a".repeat(64) });

function mockSession(value: ReturnType<typeof user> | null) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(value ? { ok: true, status: 200, json: async () => ({ data: value }) } : { ok: false, status: 401, json: async () => ({ error: { code: "AUTHENTICATION_REQUIRED" } }) }));
}

afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

describe("UI-03 authenticated shell route guards", () => {
  it("shows only requester navigation and reports a forbidden direct route", async () => {
    window.history.replaceState({}, "", "/admin/users");
    mockSession(user("REQUESTER"));
    render(<App />);
    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
    expect(screen.getByText("My Tickets")).toBeInTheDocument();
    expect(screen.queryByText("Ticket Queue")).not.toBeInTheDocument();
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
  });

  it("renders the matching Staff and Administrator destinations", async () => {
    mockSession(user("IT_STAFF"));
    const { unmount } = render(<App />);
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
    unmount();
    mockSession(user("ADMINISTRATOR"));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.queryByText("Ticket Queue")).not.toBeInTheDocument();
  });

  it("keeps a password-change-required session out of every normal route", async () => {
    window.history.replaceState({}, "", "/staff/tickets");
    mockSession(user("IT_STAFF", true));
    render(<App />);
    expect(await screen.findByText("Change your initial password before continuing")).toBeInTheDocument();
    expect(screen.queryByText("Ticket Queue")).not.toBeInTheDocument();
  });
});
