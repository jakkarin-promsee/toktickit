import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

const HEALTH_OK = { status: "ok", service: "TokTickIT API" };
const SEEDED_CATEGORIES = [
  { id: 1, name: "Account and Access" },
  { id: 2, name: "Hardware" },
  { id: 3, name: "Software" },
  { id: 4, name: "Network" },
];

// The stub sits at the network boundary rather than over src/api.ts, so these
// tests exercise the real request and validation code the browser runs. Only
// the parts of Response that api.ts touches need to exist.
function stubFetch(respond: (url: string) => Promise<unknown> | unknown) {
  const fetchMock = vi.fn(async (url: string) => respond(url));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function errorResponse(status: number, body: unknown) {
  return { ok: false, status, json: async () => body };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  // UI-01
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  // UI-02
  it("shows the loading state, then Online and the seeded categories", async () => {
    // Hold the health call open so the loading state can actually be observed.
    // A mock that resolves immediately would let React reach the success
    // render in the same tick, and the test would silently stop proving that
    // a loading state exists at all.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const fetchMock = stubFetch(async (url) => {
      if (url.includes("/api/health")) {
        await gate;
        return jsonResponse(HEALTH_OK);
      }
      return jsonResponse(SEEDED_CATEGORIES);
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /check system/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/loading/i);
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();

    release();

    await waitFor(() =>
      expect(screen.getByText("Supported Request Categories")).toBeInTheDocument()
    );

    // The loading state has to go away again, not merely be overtaken.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();

    // Which endpoints were called, in which order, and how many times. Without
    // this the stub would happily answer a misspelled path and the suite would
    // still pass — the two calls are part of the behaviour under test.
    const requested = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(requested).toHaveLength(2);
    expect(requested[0]).toMatch(/\/api\/health$/);
    expect(requested[1]).toMatch(/\/api\/categories$/);

    // Reading the items back in document order proves the list preserves the
    // order the API sent, where four separate presence checks would not.
    const rendered = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);

    expect(rendered).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
  });

  // UI-03
  it("shows an Offline error message when the backend is not running", async () => {
    // A backend that is not running makes fetch reject with a TypeError rather
    // than answer with a response — the same failure the browser produces.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /check system/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Unable to connect to TokTickIT API/i)
      ).toBeInTheDocument()
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/System Status: Offline/i);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  // UI-04
  it("renders whatever the API returns rather than a hard-coded list", async () => {
    // Names that appear nowhere in the source. If the component were painting
    // a built-in list, this test would fail while UI-02 kept passing — which
    // is the whole reason it is a separate case.
    const returnedByApi = [
      { id: 41, name: "Printer and Peripherals" },
      { id: 42, name: "Payroll System" },
    ];

    stubFetch((url) =>
      jsonResponse(url.includes("/api/health") ? HEALTH_OK : returnedByApi)
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /check system/i }));

    await waitFor(() =>
      expect(screen.getByText("Printer and Peripherals")).toBeInTheDocument()
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("Hardware")).not.toBeInTheDocument();
  });

  // UI-05
  it("shows the Offline state when the database is unavailable", async () => {
    // The failure the labsheet names in Part 4: the API process is alive, so
    // /api/health still answers 200, but it cannot reach PostgreSQL and
    // degrades /api/categories to 503.
    stubFetch((url) =>
      url.includes("/api/health")
        ? jsonResponse(HEALTH_OK)
        : errorResponse(503, { error: "Database unavailable" })
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /check system/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /System Status: Offline/i
      )
    );

    // The detail line is what tells a healthy-API-dead-database apart from a
    // dead API when someone is looking at the screen.
    expect(
      screen.getByText(/Category list failed with HTTP 503/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  // UI-06
  it("explains an empty category list instead of rendering an empty box", async () => {
    stubFetch((url) =>
      jsonResponse(url.includes("/api/health") ? HEALTH_OK : [])
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /check system/i }));

    await waitFor(() =>
      expect(screen.getByText(/returned no categories/i)).toBeInTheDocument()
    );

    // Still Online — an unseeded database is not the same failure as an outage.
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
