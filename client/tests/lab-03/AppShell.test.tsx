import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("UI-03 Issue #40 shell identity, navigation semantics, and mobile menu", () => {
  it("shows the full role text and marks the current destination with aria-current", async () => {
    window.history.replaceState({}, "", "/tickets/new");
    mockSession(user("REQUESTER"));
    render(<App />);
    const banner = await screen.findByRole("banner");
    expect(within(banner).getByText("Requester")).toHaveClass("badge-role-requester");
    expect(within(banner).queryByText("REQUESTER")).not.toBeInTheDocument();
    const nav = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(nav.getByRole("link", { name: "Create Ticket" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "My Tickets" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main-content");
  });

  it("toggles the Menu button state, closes on Escape, and returns focus to the toggle", async () => {
    const userEvents = userEvent.setup();
    mockSession(user("IT_STAFF"));
    render(<App />);
    const toggle = await screen.findByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "app-nav app-actions");
    await userEvents.click(toggle);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toHaveClass("is-open");
    await userEvents.click(screen.getByRole("link", { name: "Ticket Queue" }));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    await userEvents.click(screen.getByRole("button", { name: "Menu" }));
    await userEvents.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("gives Administrators Users and a read-only Ticket Review, and keeps Staff-only routes closed to Requesters", async () => {
    window.history.replaceState({}, "", "/staff/tickets");
    mockSession(user("ADMINISTRATOR"));
    const { unmount } = render(<App />);
    expect(await screen.findByRole("heading", { name: "Ticket Review" })).toBeInTheDocument();
    const nav = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(nav.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(nav.getByRole("link", { name: "Ticket Review" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/Read-only administrator view/)).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    unmount();
    window.history.replaceState({}, "", "/staff/tickets");
    mockSession(user("REQUESTER"));
    render(<App />);
    expect(await screen.findByText("Access restricted")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to My Tickets" })).toBeInTheDocument();
  });
});
