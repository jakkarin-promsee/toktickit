import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountBadge, ModalDialog, PriorityBadge, RoleBadge, STATUS_LABELS, StatusBadge } from "../../src/ui.js";
import type { TicketStatus } from "../../src/api.js";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <ModalDialog labelledBy="harness-title" describedBy="harness-body" onCancel={() => setOpen(false)}>
          <h2 id="harness-title">Confirm change</h2>
          <p id="harness-body">This ends all sessions.</p>
          <button>Confirm</button>
          <button data-autofocus onClick={() => setOpen(false)}>Cancel</button>
        </ModalDialog>
      )}
    </>
  );
}

describe("A11Y-01 ModalDialog focus management", () => {
  it("is a labelled modal that starts on Cancel, traps Tab both ways, closes on Escape, and restores focus", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Confirm change" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("This ends all sessions.");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("STYLE-01 shared badge vocabulary", () => {
  it("renders every status with its full text and its own tint class", () => {
    const statuses = Object.keys(STATUS_LABELS) as TicketStatus[];
    render(<>{statuses.map((status) => <StatusBadge key={status} status={status} />)}</>);
    for (const status of statuses) {
      const badge = screen.getByText(STATUS_LABELS[status]);
      expect(badge).toHaveClass("badge", "badge-status", `badge-status-${status.toLowerCase().replace(/_/g, "-")}`);
    }
  });

  it("labels Requested and IT Priority separately and spells roles and account states in full", () => {
    render(<>
      <PriorityBadge kind="Requested" priority="HIGH" />
      <PriorityBadge kind="IT" priority="LOW" />
      <RoleBadge role="IT_STAFF" />
      <RoleBadge role="ADMINISTRATOR" />
      <AccountBadge state="Password change required" />
    </>);
    expect(screen.getByText("Requested: High")).toHaveClass("badge-priority-high");
    expect(screen.getByText("IT: Low")).toHaveClass("badge-priority-low");
    expect(screen.getByText("IT Staff")).toHaveClass("badge-role-it-staff");
    expect(screen.getByText("Administrator")).toHaveClass("badge-role-administrator");
    expect(screen.getByText("Password change required")).toHaveClass("badge-account-password-change-required");
  });
});
