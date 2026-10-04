import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

afterEach(() => vi.restoreAllMocks());

describe("UI-01 Login", () => {
  it("validates fields and shows a safe authentication failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { code: "AUTHENTICATION_FAILED" } }) }));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "anan@example.test");
    await user.type(screen.getByLabelText("Password"), "Wrong!Pass123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Sign-in failed. Check your credentials or account status.")).toBeInTheDocument();
  });
});

const signedIn = (role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR", mustChangePassword = false) => ({ id: 7, displayName: "Narin Staff", email: "narin.staff@example.test", role, isActive: true, mustChangePassword, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "c".repeat(64) });
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) => ({ ok: status < 400, status, headers: new Headers(headers), json: async () => body });
const anonymous = reply(401, { error: { code: "AUTHENTICATION_REQUIRED" } });

// Routes /api/auth/me to "no session" and lets each test decide the login response.
function mockAuth(loginResponse: () => Promise<unknown>, otherResponse: unknown = reply(500, { error: { code: "INTERNAL_ERROR" } })) {
  const fetchMock = vi.fn((url: string) => {
    if (url.endsWith("/api/auth/me")) return Promise.resolve(anonymous);
    if (url.endsWith("/api/auth/login")) return loginResponse();
    return Promise.resolve(otherResponse);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, email = "narin.staff@example.test", password = "Any!Passw0rd-38") {
  await user.type(await screen.findByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("UI-01 Login Issue #38 coverage", () => {
  it("rejects an invalid email format and a password over 128 characters locally without calling login", async () => {
    const user = userEvent.setup();
    const fetchMock = mockAuth(() => Promise.resolve(reply(200, { data: signedIn("REQUESTER") })));
    render(<App />);
    await fillAndSubmit(user, "not-an-email", "x");
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Email"));
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Email"), "anan@example.test");
    await user.click(screen.getByLabelText("Password"));
    await user.paste("x".repeat(129));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Password must contain 128 characters or fewer.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/auth/login"))).toHaveLength(0);
  });

  it("shows a busy state, disables the form, and sends only one request while signing in", async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: unknown) => void = () => undefined;
    const fetchMock = mockAuth(() => new Promise((resolve) => { resolveLogin = resolve; }));
    render(<App />);
    await fillAndSubmit(user);
    const busy = screen.getByRole("button", { name: "Signing in…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Email")).toBeDisabled();
    await user.click(busy);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/auth/login"))).toHaveLength(1);
    resolveLogin(reply(401, { error: { code: "AUTHENTICATION_FAILED" } }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("uses the same safe copy for an inactive account, clears the password, and never names the account state", async () => {
    const user = userEvent.setup();
    mockAuth(() => Promise.resolve(reply(401, { error: { code: "AUTHENTICATION_FAILED", message: "Sign-in failed. Check your credentials or account status." } })));
    render(<App />);
    await fillAndSubmit(user, "somchai.inactive@example.test");
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in failed. Check your credentials or account status.");
    expect(screen.queryByText(/inactive|deactivated|not found|does not exist/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("reports rate limiting with the Retry-After value", async () => {
    const user = userEvent.setup();
    mockAuth(() => Promise.resolve(reply(429, { error: { code: "TOO_MANY_ATTEMPTS" } }, { "Retry-After": "12" })));
    render(<App />);
    await fillAndSubmit(user);
    expect(await screen.findByText("Too many sign-in attempts. Try again in 12 minutes.")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    mockAuth(() => Promise.resolve(anonymous));
    render(<App />);
    const toggle = await screen.findByRole("button", { name: "Show password" });
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    await user.click(toggle);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("routes each role to its home destination with the user's name and role", async () => {
    const user = userEvent.setup();
    mockAuth(() => Promise.resolve(reply(200, { data: signedIn("IT_STAFF") })));
    render(<App />);
    await fillAndSubmit(user);
    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByText("IT_STAFF")).toBeInTheDocument();
    expect(screen.getByText(/Narin Staff/)).toBeInTheDocument();
    expect(screen.queryByText("User Management")).not.toBeInTheDocument();
  });

  it("sends a password-change-required login to the Change Password gate", async () => {
    const user = userEvent.setup();
    mockAuth(() => Promise.resolve(reply(200, { data: signedIn("REQUESTER", true) })));
    render(<App />);
    await fillAndSubmit(user);
    expect(await screen.findByText("Change your initial password before continuing")).toBeInTheDocument();
    expect(screen.queryByText("My Tickets")).not.toBeInTheDocument();
  });
});
