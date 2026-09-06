import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const requesters = [
  { id: 1, displayName: "Anan Chai", email: "anan@example.test" },
];
const categories = [{ id: 2, name: "Hardware" }];
const systems = [{ id: 7, name: "Corporate Laptop" }];

function setupFetch(createResponse?: unknown, attachmentFailure = false) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.endsWith("/api/requesters")) return Promise.resolve(jsonResponse({ data: requesters }));
    if (url.endsWith("/api/categories")) return Promise.resolve(jsonResponse(categories));
    if (url.endsWith("/api/related-systems")) return Promise.resolve(jsonResponse(systems));
    if (url.includes("/attachments")) {
      return Promise.resolve(
        attachmentFailure
          ? jsonResponse({ error: { message: "Storage unavailable." } }, 503)
          : jsonResponse({ data: { id: "attachment-1", originalName: "evidence.pdf", state: "ACTIVE" } }),
      );
    }
    if (url.endsWith("/api/tickets")) {
      return Promise.resolve(
        createResponse instanceof Error
          ? Promise.reject(createResponse)
          : jsonResponse(createResponse ?? {
              data: {
                id: "ticket-1",
                ticketNumber: "TKT-20260906-000001",
                ticketDate: "2026-09-06T03:12:00.000Z",
                requester: { id: 1, displayName: "Anan Chai" },
                category: categories[0],
                relatedSystem: systems[0],
                summary: "Laptop battery drains quickly",
                requestedPriority: "MEDIUM",
                itPriority: "UNASSIGNED",
                currentStatus: "NEW",
                description: "Battery falls from full to 20% within one hour.",
                createdAt: "2026-09-06T03:12:00.000Z",
                updatedAt: "2026-09-06T03:12:00.000Z",
              },
            }),
      );
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

async function openCreateTicket(createResponse?: unknown, attachmentFailure = false) {
  localStorage.setItem("toktickit.requesterId", "1");
  const fetch = setupFetch(createResponse, attachmentFailure);
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("link", { name: /create ticket/i }));
  await screen.findByRole("heading", { name: /create ticket/i });
  await screen.findByRole("option", { name: /hardware/i });
  return { user, fetch };
}

describe("Create Ticket", () => {
  it("renders required editable fields and backend-controlled read-only fields", async () => {
    await openCreateTicket();

    expect(screen.getByLabelText(/ticket number/i)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/ticket date/i)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/requester/i)).toHaveAttribute("readonly");
    expect(screen.getByLabelText(/category/i)).toBeRequired();
    expect(screen.getByLabelText(/related system/i)).toBeRequired();
    expect(screen.getByLabelText(/ticket summary/i)).toBeRequired();
    expect(screen.getByLabelText(/description/i)).toBeRequired();
  });

  it("shows field validation and does not call the API for invalid input", async () => {
    const fetch = setupFetch();
    vi.stubGlobal("fetch", fetch);
    localStorage.setItem("toktickit.requesterId", "1");
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("link", { name: /create ticket/i }));
    await user.click(await screen.findByRole("button", { name: /create ticket/i }));

    expect(await screen.findByText(/summary must contain 5–120 characters/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ticket summary/i)).toHaveAttribute("aria-invalid", "true");
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/tickets"),
      expect.anything(),
    );
  });

  it("shows busy state, official number, and prevents duplicate submissions", async () => {
    const { user, fetch } = await openCreateTicket();
    await user.selectOptions(screen.getByLabelText(/category/i), "2");
    await user.selectOptions(screen.getByLabelText(/related system/i), "7");
    await user.type(screen.getByLabelText(/ticket summary/i), "Laptop battery drains quickly");
    await user.selectOptions(screen.getByLabelText(/requested priority/i), "MEDIUM");
    await user.type(
      screen.getByLabelText(/description/i),
      "Battery falls from full to 20% within one hour.",
    );
    await user.click(screen.getByRole("button", { name: /create ticket/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/TKT-20260906-000001/);
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith("/api/tickets")).length).toBe(1);
  });

  it("retains entered values and shows a safe error after API failure", async () => {
    const { user } = await openCreateTicket(new Error("database secret"));
    await user.selectOptions(screen.getByLabelText(/category/i), "2");
    await user.selectOptions(screen.getByLabelText(/related system/i), "7");
    await user.type(screen.getByLabelText(/ticket summary/i), "Laptop battery drains quickly");
    await user.selectOptions(screen.getByLabelText(/requested priority/i), "MEDIUM");
    await user.type(
      screen.getByLabelText(/description/i),
      "Battery falls from full to 20% within one hour.",
    );
    await user.click(screen.getByRole("button", { name: /create ticket/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/couldn't create the ticket/i));
    expect(screen.getByLabelText(/ticket summary/i)).toHaveValue("Laptop battery drains quickly");
    expect(screen.queryByText(/database secret/i)).not.toBeInTheDocument();
  });

  it("keeps the created Ticket and offers retry when an initial attachment upload fails", async () => {
    const { user } = await openCreateTicket(undefined, true);
    await user.selectOptions(screen.getByLabelText(/category/i), "2");
    await user.selectOptions(screen.getByLabelText(/related system/i), "7");
    await user.type(screen.getByLabelText(/ticket summary/i), "Laptop battery drains quickly");
    await user.selectOptions(screen.getByLabelText(/requested priority/i), "MEDIUM");
    await user.type(screen.getByLabelText(/description/i), "Battery falls from full to 20% within one hour.");
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "evidence.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/supporting files/i), file);
    await user.click(screen.getByRole("button", { name: /create ticket/i }));

    expect(await screen.findByText(/official ticket number/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/upload.*failed/i);
    expect(screen.getByRole("button", { name: /retry failed uploads/i })).toBeInTheDocument();
  });
});
