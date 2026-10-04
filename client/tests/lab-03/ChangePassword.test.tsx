import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

afterEach(() => vi.restoreAllMocks());

describe("UI-02 Change Password", () => {
  it("routes an initial-password session to the gated password form and validates confirmation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { id: 1, displayName: "Anan Chai", email: "anan@example.test", role: "REQUESTER", isActive: true, mustChangePassword: true, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "a".repeat(64) } }) }));
    render(<App />);
    expect(await screen.findByText("Change your initial password before continuing")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Current password"), "Example!Pass123");
    await user.type(screen.getByLabelText("New password"), "Changed!Pass123");
    await user.type(screen.getByLabelText("Confirm new password"), "Different!Pass123");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });
});

const gated = { id: 1, displayName: "Anan Chai", email: "anan@example.test", role: "REQUESTER", isActive: true, mustChangePassword: true, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "a".repeat(64) };
const reply = (status: number, body: unknown) => ({ ok: status < 400, status, headers: new Headers(), json: async () => body });

function mockGate(changeResponse: () => Promise<unknown>, logoutResponse: unknown = reply(204, {})) {
  const fetchMock = vi.fn((url: string) => {
    if (url.endsWith("/api/auth/me")) return Promise.resolve(reply(200, { data: gated }));
    if (url.endsWith("/api/auth/change-password")) return changeResponse();
    if (url.endsWith("/api/auth/logout")) return Promise.resolve(logoutResponse);
    if (url.endsWith("/api/tickets") || url.includes("/api/tickets?")) return Promise.resolve({ ok: true, status: 200, headers: new Headers(), json: async () => ({ data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }) });
    return Promise.resolve(reply(200, { data: [] }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fill(user: ReturnType<typeof userEvent.setup>, current: string, next: string, confirmation = next) {
  if (current) await user.type(await screen.findByLabelText("Current password"), current);
  if (next) await user.type(screen.getByLabelText("New password"), next);
  if (confirmation) await user.type(screen.getByLabelText("Confirm new password"), confirmation);
  await user.click(screen.getByRole("button", { name: "Change password" }));
}

const changeCalls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/auth/change-password"));

describe("UI-02 Change Password Issue #38 coverage", () => {
  it("enforces 12–128 characters, composition, and a different password locally", async () => {
    const user = userEvent.setup();
    const fetchMock = mockGate(() => Promise.resolve(reply(200, { data: { ...gated, mustChangePassword: false } })));
    render(<App />);
    await screen.findByLabelText("Current password");
    await fill(user, "", "Abcdefg1!xy");
    expect(screen.getByText("Current password is required.")).toBeInTheDocument();
    expect(screen.getByText("Password must contain 12–128 characters.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("New password"));
    await user.clear(screen.getByLabelText("Confirm new password"));
    await fill(user, "Example!Pass123", "alllowercase12!", "alllowercase12!");
    expect(screen.getByText("Password must contain lowercase, uppercase, digit, and symbol characters.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("New password"));
    await user.clear(screen.getByLabelText("Confirm new password"));
    await fill(user, "", "Example!Pass123");
    expect(screen.getByText("New password must differ from current password.")).toBeInTheDocument();
    expect(changeCalls(fetchMock)).toHaveLength(0);
  });

  it("maps a wrong current password from the server to its field and keeps the user on the gate", async () => {
    const user = userEvent.setup();
    mockGate(() => Promise.resolve(reply(422, { error: { code: "VALIDATION_ERROR", fields: { currentPassword: "Current password is incorrect." } } })));
    render(<App />);
    await fill(user, "Wrong!Passw0rd-38", "Changed!Pass123");
    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(screen.getByText("Check the highlighted fields.")).toBeInTheDocument();
    expect(screen.getByText("Change your initial password before continuing")).toBeInTheDocument();
  });

  it("shows a safe failure when the service is unavailable", async () => {
    const user = userEvent.setup();
    mockGate(() => Promise.resolve(reply(503, { error: { code: "DEPENDENCY_UNAVAILABLE" } })));
    render(<App />);
    await fill(user, "Example!Pass123", "Changed!Pass123");
    expect(await screen.findByText("We could not change your password right now. Try again.")).toBeInTheDocument();
  });

  it("sends the CSRF token once, shows busy feedback, and continues into the application on success", async () => {
    const user = userEvent.setup();
    let resolveChange: (value: unknown) => void = () => undefined;
    const fetchMock = mockGate(() => new Promise((resolve) => { resolveChange = resolve; }));
    render(<App />);
    await fill(user, "Example!Pass123", "Changed!Pass123");
    expect(screen.getByRole("button", { name: "Changing password…" })).toBeDisabled();
    expect(changeCalls(fetchMock)).toHaveLength(1);
    const [, init] = changeCalls(fetchMock)[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("a".repeat(64));
    expect(JSON.parse(String(init.body))).toEqual({ currentPassword: "Example!Pass123", newPassword: "Changed!Pass123" });
    resolveChange(reply(200, { data: { ...gated, mustChangePassword: false, csrfToken: "b".repeat(64) } }));
    expect(await screen.findByText("Password changed")).toBeInTheDocument();
    expect(screen.queryByText("Change your initial password before continuing")).not.toBeInTheDocument();
  });

  it("lets a gated user log out back to Sign in", async () => {
    const user = userEvent.setup();
    const fetchMock = mockGate(() => Promise.resolve(reply(500, {})));
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/auth/logout"))).toBe(true);
  });
});
