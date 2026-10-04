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
