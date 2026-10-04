import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const me = { id: 1, displayName: "Anan Chai", email: "anan@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false, sessionExpiresAt: "2026-10-04T08:00:00.000Z", csrfToken: "a".repeat(64) };
const NEW_ID = "41000000-0000-4000-8000-000000000001";

function mockApi(createResponse?: { status: number; body: unknown }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace("http://localhost:3000", "");
    let result: { status: number; body: unknown } = { status: 404, body: { error: { code: "RESOURCE_NOT_FOUND", message: "Ticket was not found." } } };
    if (url === "/api/auth/me") result = { status: 200, body: { data: me } };
    else if (url === "/api/categories") result = { status: 200, body: [{ id: 1, name: "Software" }] };
    else if (url === "/api/related-systems") result = { status: 200, body: [{ id: 2, name: "VPN" }] };
    else if (url === "/api/tickets" && init?.method === "POST") result = createResponse ?? { status: 201, body: { data: { id: NEW_ID } } };
    return { ok: result.status < 400, status: result.status, headers: new Headers(), json: async () => result.body };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("heading", { name: "Create Ticket" });
  await user.selectOptions(screen.getByLabelText("Category"), "1");
  await user.selectOptions(screen.getByLabelText("Related System"), "2");
  await user.type(screen.getByLabelText("Summary"), "VPN will not connect");
  await user.type(screen.getByLabelText("Description"), "The VPN fails after sign in.");
}

describe("UI-04 Requester Create Ticket", () => {
  it("validates required fields client-side without calling the API and has no requester selector", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    window.history.replaceState({}, "", "/tickets/new");
    render(<App />);
    await screen.findByRole("heading", { name: "Create Ticket" });
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));
    expect(screen.getByText("Select a category.")).toBeInTheDocument();
    expect(screen.getByText("Summary must contain 5–120 characters.")).toBeInTheDocument();
    expect(screen.getByText("Description must contain 10–2,000 characters.")).toBeInTheDocument();
    expect(screen.queryByText(/Change Requester/i)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("submits without any requester identity in the body and opens the new ticket", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi();
    window.history.replaceState({}, "", "/tickets/new");
    render(<App />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));
    await vi.waitFor(() => expect(window.location.pathname).toBe(`/tickets/${NEW_ID}`));
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")!;
    const body = JSON.parse((post[1] as RequestInit).body as string);
    expect(Object.keys(body).sort()).toEqual(["categoryId", "description", "relatedSystemId", "requestedPriority", "summary"]);
    expect((post[1] as RequestInit).headers).toMatchObject({ "X-CSRF-Token": me.csrfToken });
  });

  it("shows server field errors and keeps the input on failure", async () => {
    const user = userEvent.setup();
    mockApi({ status: 422, body: { error: { code: "VALIDATION_ERROR", message: "Some fields are invalid.", fields: { categoryId: "Category is invalid or inactive." } } } });
    window.history.replaceState({}, "", "/tickets/new");
    render(<App />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit ticket" }));
    expect(await screen.findByText("Category is invalid or inactive.")).toBeInTheDocument();
    expect(screen.getByLabelText("Summary")).toHaveValue("VPN will not connect");
  });
});
