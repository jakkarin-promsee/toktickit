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
  { id: 2, displayName: "Mali Srisuk", email: "mali@example.test" },
];

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Development Requester selection", () => {
  it("loads active requesters and keeps Continue disabled until a selection is made", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: requesters })));

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading active requesters/i);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /anan chai/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(screen.getByText(/this is not a login screen/i)).toBeInTheDocument();
  });

  it("persists the selected requester and shows the application shell", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: requesters })));
    const user = userEvent.setup();

    render(<App />);
    await user.selectOptions(
      await screen.findByLabelText(/^Development Requester$/),
      "1",
    );
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(localStorage.getItem("toktickit.requesterId")).toBe("1");
    expect(screen.getByRole("banner")).toHaveTextContent("Anan Chai");
    expect(screen.getByRole("button", { name: /change requester/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("restores a valid persisted requester and clears requester state when changed", async () => {
    localStorage.setItem("toktickit.requesterId", "1");
    sessionStorage.setItem("toktickit.requester.draft", "stale form");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: requesters })));
    const user = userEvent.setup();

    render(<App />);
    expect(await screen.findByRole("banner")).toHaveTextContent("Anan Chai");
    await user.click(screen.getByRole("button", { name: /change requester/i }));
    await user.selectOptions(screen.getByLabelText(/^Development Requester$/), "2");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(localStorage.getItem("toktickit.requesterId")).toBe("2");
    expect(sessionStorage.getItem("toktickit.requester.draft")).toBeNull();
    expect(screen.getByRole("banner")).toHaveTextContent("Mali Srisuk");
  });

  it("shows safe empty and failure states", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [] })));
    const { unmount } = render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no active development requesters/i,
    );
    unmount();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("database details")));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't load requesters/i,
    );
    expect(screen.queryByText(/database details/i)).not.toBeInTheDocument();
  });
});
