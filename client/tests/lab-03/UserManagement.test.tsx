import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const admin = { id: 10, displayName: "Araya Admin", email: "araya.admin@example.test", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "a".repeat(64) };

function person(overrides: Record<string, unknown> = {}) {
  return { id: 1, displayName: "Anan Chai", email: "anan@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false, version: 0, createdAt: "2026-10-04T01:00:00.000Z", updatedAt: "2026-10-04T01:00:00.000Z", ...overrides };
}

const users = [
  person(),
  person({ id: 6, displayName: "Narin Support", email: "narin.staff@example.test", role: "IT_STAFF", mustChangePassword: true }),
  person({ id: 10, displayName: "Araya Admin", email: "araya.admin@example.test", role: "ADMINISTRATOR" }),
  person({ id: 11, displayName: "Somchai Inactive", email: "somchai@example.test", isActive: false }),
];

type Call = { url: string; method: string; body?: Record<string, unknown> };
type Handler = (call: Call) => { status: number; body?: unknown } | undefined;

function mockApi(handler: Handler = () => undefined) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace("http://localhost:3000", "");
    const call: Call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined };
    calls.push(call);
    const result = handler(call) ?? (url === "/api/auth/me" ? { status: 200, body: { data: admin } } : url.startsWith("/api/admin/users") && call.method === "GET" ? { status: 200, body: { data: users } } : { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Unexpected." } } });
    return { ok: result.status < 400, status: result.status, headers: new Headers(), json: async () => result.body ?? {} };
  }));
  return calls;
}

function open() {
  window.history.replaceState({}, "", "/admin/users");
  render(<App />);
}

afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

const strong = "Valid!Passw0rd-xyz";

describe("UI-07 User Management list", () => {
  it("shows loading, then name, email, role, status, and an Edit action in both table and cards", async () => {
    mockApi();
    open();
    expect(await screen.findByText("Loading users…")).toBeInTheDocument();
    const table = await screen.findByRole("table");
    for (const header of ["Name", "Email", "Role", "Status", "Edit"]) expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    expect(within(table).getByText("narin.staff@example.test")).toBeInTheDocument();
    expect(within(table).getByText("Password change required")).toBeInTheDocument();
    expect(within(table).getByText("Inactive")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit Anan Chai" }).length).toBe(2);
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/import|export|bulk/i)).not.toBeInTheDocument();
  });

  it("sends search and role filters to the API and offers Clear", async () => {
    const user = userEvent.setup();
    const calls = mockApi();
    open();
    await screen.findByRole("table");
    await user.type(screen.getByLabelText("Search users"), "narin");
    await user.selectOptions(screen.getByLabelText("Role"), "IT_STAFF");
    await waitFor(() => expect(calls.at(-1)!.url).toBe("/api/admin/users?search=narin&role=IT_STAFF"), { timeout: 2000 });
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(calls.at(-1)!.url).toBe("/api/admin/users"));
    expect(screen.getByLabelText("Search users")).toHaveValue("");
  });

  it("distinguishes no users, no results, forbidden, and failure with retry", async () => {
    const user = userEvent.setup();
    mockApi((call) => call.url.startsWith("/api/admin/users") ? { status: 200, body: { data: [] } } : undefined);
    open();
    expect(await screen.findByText(/No users exist yet/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search users"), "zzz");
    expect(await screen.findByText("No users match", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByText(/No users exist yet/)).not.toBeInTheDocument();
  });

  it("shows forbidden without user data and a safe failure that retries", async () => {
    const user = userEvent.setup();
    mockApi((call) => call.url.startsWith("/api/admin/users") ? { status: 403, body: { error: { code: "FORBIDDEN" } } } : undefined);
    const first = (open(), screen);
    expect(await first.findByText(/Forbidden\. Your account is not permitted/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    vi.restoreAllMocks();
    let calls = 0;
    mockApi((call) => { if (!call.url.startsWith("/api/admin/users")) return undefined; calls += 1; return calls === 1 ? { status: 503, body: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "x" } } } : { status: 200, body: { data: users } }; });
    document.body.innerHTML = "";
    render(<App />);
    expect(await screen.findByText(/Users could not be loaded/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});

describe("UI-07 create user", () => {
  it("validates every field locally without calling the API", async () => {
    const user = userEvent.setup();
    const calls = mockApi();
    open();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Create user" }));
    const form = await screen.findByRole("form", { name: "Create user" }).catch(() => screen.getByLabelText("Display name").closest("form")!);
    await user.click(within(form as HTMLElement).getByRole("button", { name: "Create user" }));
    expect(screen.getByText("Display name must contain 2–100 characters.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password must contain 12–128 characters.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Initial password"), strong);
    await user.type(screen.getByLabelText("Confirm initial password"), "different");
    await user.click(within(form as HTMLElement).getByRole("button", { name: "Create user" }));
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("creates a user with exactly one role and no password echo, then refreshes and reports success", async () => {
    const user = userEvent.setup();
    const calls = mockApi((call) => call.method === "POST" && call.url === "/api/admin/users" ? { status: 201, body: { data: person({ id: 20, displayName: "Pim Support", email: "pim@example.test", role: "IT_STAFF", mustChangePassword: true }) } } : undefined);
    open();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Create user" }));
    await user.type(await screen.findByLabelText("Display name"), "Pim Support");
    await user.type(screen.getByLabelText("Email"), "pim@example.test");
    await user.selectOptions(screen.getByLabelText("Role", { selector: "#user-role" }), "IT_STAFF");
    await user.type(screen.getByLabelText("Initial password"), strong);
    await user.type(screen.getByLabelText("Confirm initial password"), strong);
    const form = screen.getByLabelText("Display name").closest("form")!;
    await user.click(within(form).getByRole("button", { name: "Create user" }));
    expect(await screen.findByText("User Pim Support created.")).toBeInTheDocument();
    const post = calls.find((call) => call.method === "POST")!;
    expect(post.body).toEqual({ displayName: "Pim Support", email: "pim@example.test", role: "IT_STAFF", isActive: true, initialPassword: strong });
    expect(document.body.textContent).not.toContain(strong);
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
  });

  it("maps a duplicate email to the Email field and keeps the other input", async () => {
    const user = userEvent.setup();
    mockApi((call) => call.method === "POST" ? { status: 409, body: { error: { code: "EMAIL_ALREADY_EXISTS", message: "A user with this email already exists." } } } : undefined);
    open();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Create user" }));
    await user.type(await screen.findByLabelText("Display name"), "Pim Support");
    await user.type(screen.getByLabelText("Email"), "anan@example.test");
    await user.type(screen.getByLabelText("Initial password"), strong);
    await user.type(screen.getByLabelText("Confirm initial password"), strong);
    await user.click(within(screen.getByLabelText("Display name").closest("form")!).getByRole("button", { name: "Create user" }));
    expect(await screen.findByText("A user with this email already exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toHaveValue("Pim Support");
  });

  it("asks before discarding a dirty form", async () => {
    const user = userEvent.setup();
    mockApi();
    open();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Create user" }));
    await user.type(await screen.findByLabelText("Display name"), "Draft");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog", { name: "Discard changes?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Display name")).toHaveValue("Draft");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Discard changes?" })).getByRole("button", { name: "Discard" }));
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
  });
});

describe("UI-07 edit user", () => {
  it("edits name without confirmation and sends the full editable set with the version", async () => {
    const user = userEvent.setup();
    const calls = mockApi((call) => call.method === "PATCH" ? { status: 200, body: { data: person({ displayName: "Anan Renamed", version: 1 }) } } : undefined);
    open();
    await screen.findByRole("table");
    await user.click(screen.getAllByRole("button", { name: "Edit Anan Chai" })[0]);
    const name = await screen.findByLabelText("Display name");
    await user.clear(name);
    await user.type(name, "Anan Renamed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("User Anan Renamed updated.")).toBeInTheDocument();
    expect(calls.find((call) => call.method === "PATCH")!.body).toEqual({ displayName: "Anan Renamed", email: "anan@example.test", role: "REQUESTER", isActive: true, version: 0 });
  });

  it("requires confirmation naming the user and session revocation for a role change", async () => {
    const user = userEvent.setup();
    const calls = mockApi((call) => call.method === "PATCH" ? { status: 200, body: { data: person({ role: "IT_STAFF", version: 1 }) } } : undefined);
    open();
    await screen.findByRole("table");
    await user.click(screen.getAllByRole("button", { name: "Edit Anan Chai" })[0]);
    await user.selectOptions(await screen.findByLabelText("Role", { selector: "#user-role" }), "IT_STAFF");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm role or status change" });
    expect(within(dialog).getByText(/Anan Chai ends all of their current sessions/)).toBeInTheDocument();
    expect(calls.some((call) => call.method === "PATCH")).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("User Anan Chai updated.")).toBeInTheDocument();
  });

  it("disables role and active controls when editing the signed-in Administrator", async () => {
    const user = userEvent.setup();
    mockApi();
    open();
    await screen.findByRole("table");
    await user.click(screen.getAllByRole("button", { name: "Edit Araya Admin" })[0]);
    expect(await screen.findByLabelText("Role", { selector: "#user-role" })).toBeDisabled();
    expect(screen.getByLabelText("Active")).toBeDisabled();
    expect(screen.getByText(/cannot change your own role/)).toBeInTheDocument();
  });

  it("maps owner and last-admin conflicts to alerts and a stale version to Reload", async () => {
    const user = userEvent.setup();
    let code = "USER_OWNS_TICKETS";
    mockApi((call) => call.method === "PATCH" ? { status: 409, body: { error: { code, message: "conflict" } } } : undefined);
    open();
    await screen.findByRole("table");
    await user.click(screen.getAllByRole("button", { name: "Edit Narin Support" })[0]);
    await user.click(await screen.findByLabelText("Active"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Confirm role or status change" })).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/Reassign owned Tickets before deactivating/)).toBeInTheDocument();
    code = "STALE_USER";
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Confirm role or status change" })).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/This user changed\. Reload before trying again\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toHaveValue("Narin Support");
  });

  it("sets a new initial password through a separate warning dialog without displaying the password", async () => {
    const user = userEvent.setup();
    const calls = mockApi((call) => call.url.endsWith("/initial-password") ? { status: 204 } : undefined);
    open();
    await screen.findByRole("table");
    await user.click(screen.getAllByRole("button", { name: "Edit Anan Chai" })[0]);
    await user.click(await screen.findByRole("button", { name: "Set new initial password" }));
    const dialog = await screen.findByRole("dialog", { name: /Set new initial password for Anan Chai/ });
    expect(within(dialog).getByText(/All current sessions for this user will end/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Set password" }));
    expect(within(dialog).getByText("Password must contain 12–128 characters.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("New initial password"), strong);
    await user.type(within(dialog).getByLabelText("Confirm new initial password"), "mismatch");
    await user.click(within(dialog).getByRole("button", { name: "Set password" }));
    expect(within(dialog).getByText("Passwords do not match.")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Confirm new initial password"));
    await user.type(within(dialog).getByLabelText("Confirm new initial password"), strong);
    await user.click(within(dialog).getByRole("button", { name: "Set password" }));
    expect(await screen.findByText(/New initial password set for Anan Chai/)).toBeInTheDocument();
    expect(calls.find((call) => call.url.endsWith("/initial-password"))!.body).toEqual({ initialPassword: strong });
    expect(document.body.textContent).not.toContain(strong);
  });
});
