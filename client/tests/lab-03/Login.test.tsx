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
