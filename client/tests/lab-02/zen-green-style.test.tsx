import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../src/styles.css";
import App from "../../src/App.js";

function stylesheetText() {
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText))
    .join("\n");
}

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

describe("Issue #17 Zen Green integration contract", () => {
  it("exposes the theme tokens and responsive shell hooks", async () => {
    const styles = stylesheetText();
    localStorage.setItem("toktickit.requesterId", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith("/api/requesters")) {
          return Promise.resolve(response({
            data: [{ id: 1, displayName: "Anan Chai", email: "anan@example.test" }],
          }));
        }
        if (url.endsWith("/api/tickets")) {
          return Promise.resolve(response({
            data: [],
            pagination: {
              page: 1,
              pageSize: 10,
              totalItems: 0,
              totalPages: 0,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }));
        }
        if (url.endsWith("/api/categories") || url.endsWith("/api/related-systems")) {
          return Promise.resolve(response([]));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }),
    );

    render(<App />);

    expect(await screen.findByRole("banner")).toHaveClass("app-header");
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toHaveClass(
      "app-navigation",
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "zen-green");
    expect(document.querySelector(".app-menu-toggle")).toBeInTheDocument();
    for (const token of [
      "--green-700: #006b3c",
      "--green-600: #0b7a46",
      "--green-050: #eaf6ef",
      "--page: #f5f7f6",
      "--surface: #ffffff",
      "--text: #17352a",
      "--readonly: #f1f3ee",
      "--danger: #9b1c1c",
      "--warning: #9a6700",
    ]) {
      expect(styles).toContain(token);
    }
    expect(styles).toContain(":focus-visible");
    expect(styles).toContain("outline: 3px solid var(--green-600)");
    expect(styles).toContain("@media (max-width: 767px)");
    expect(styles).not.toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/s);
  });

  it("marks required and read-only controls semantically on Create Ticket", async () => {
    const styles = stylesheetText();
    localStorage.setItem("toktickit.requesterId", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith("/api/requesters")) {
          return Promise.resolve(response({
            data: [{ id: 1, displayName: "Anan Chai", email: "anan@example.test" }],
          }));
        }
        if (url.endsWith("/api/categories")) {
          return Promise.resolve(response([{ id: 2, name: "Hardware" }]));
        }
        if (url.endsWith("/api/related-systems")) {
          return Promise.resolve(response([{ id: 7, name: "Corporate Laptop" }]));
        }
        if (url.endsWith("/api/tickets")) {
          return Promise.resolve(response({
            data: [],
            pagination: {
              page: 1,
              pageSize: 10,
              totalItems: 0,
              totalPages: 0,
              hasPreviousPage: false,
              hasNextPage: false,
            },
          }));
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }),
    );

    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "My Tickets" });
    await user.click(screen.getByRole("link", { name: "Create Ticket" }));

    expect(await screen.findByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ticket Number")).toHaveClass("readonly-field");
    expect(screen.getByLabelText("Ticket Summary *")).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText("Description *")).toHaveClass("description-field");
    expect(screen.getByLabelText("Ticket Summary *")).toHaveAttribute("required");
    expect(screen.getAllByText("*", { selector: ".required-marker" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Create Ticket" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(styles).toContain(".zen-card");
    expect(styles).toContain(".badge-zen");
    expect(styles).toContain(".badge-priority");
    expect(styles).toContain(".badge-muted");
    expect(styles).toContain(".modal[aria-modal=\"true\"]");
  });
});
