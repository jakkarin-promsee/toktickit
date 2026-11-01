import { expect, test, type Page } from "@playwright/test";
import { accounts, apiUrl, csrfHeaders, openMenuIfCollapsed, signInReady } from "../lab-03/helpers";
import { actions, createAction, freshTicket, screenshot, staffTicket } from "./helpers";

async function move(page: Page, target: string, confirmed = false) {
  await page.getByRole("button", { name: `Move to ${target}` }).click();
  if (confirmed) await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(`Status changed to ${target}.`)).toBeVisible();
}

async function completeForOwner(page: Page, ticketId: string, description: string) {
  const created = await createAction(page, ticketId, description, "Work completed and verified");
  const ticket = await staffTicket(page, ticketId);
  const assignment = await page.request.patch(`${apiUrl}/api/tickets/${ticketId}/actions/${created.id}/assignee`, { headers: await csrfHeaders(page), data: { ticketVersion: ticket.version, actionVersion: created.version, assigneeId: ticket.owner!.id } });
  expect(assignment.status(), await assignment.text()).toBe(200);
  await page.reload();
  const row = page.locator(`#action-${created.id}`);
  await row.getByRole("button", { name: "View action" }).click();
  await row.getByRole("button", { name: "Complete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(row).toContainText("COMPLETED");
  return created.id;
}

test.describe("E2E-02 Ticket resolution", () => {
  test("blocks zero-action resolution, keeps Requester indication advisory, and requires current-cycle completed work", async ({ page, request }) => {
    const ticket = await freshTicket(request, "Resolution gate");
    await signInReady(page, accounts.narin.email);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await page.getByRole("button", { name: "Claim ticket" }).click();
    await move(page, "Open");
    await move(page, "In Progress");
    await page.getByRole("button", { name: "Move to Resolved" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("alert")).toContainText("Complete an action for this Ticket before resolving it.");
    expect((await staffTicket(page, ticket.id)).currentStatus).toBe("IN_PROGRESS");
    await screenshot(page, "workflow", "resolution-blocked-zero-actions");
    await move(page, "Waiting for Requester");
    await openMenuIfCollapsed(page);
    await page.getByRole("button", { name: "Logout" }).click();
    await signInReady(page, accounts.anan.email);
    await page.goto(`/tickets/${ticket.id}`);
    await page.getByRole("button", { name: "Problem appears resolved" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/You indicated the problem appears resolved/)).toBeVisible();
    await expect(page.getByText("Waiting for Requester").first()).toBeVisible();
    await screenshot(page, "workflow", "requester-advisory-indication");
    await openMenuIfCollapsed(page);
    await page.getByRole("button", { name: "Logout" }).click();
    await signInReady(page, accounts.narin.email);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await expect(page.getByText(/Requester indication/)).toBeVisible();
    const firstActionId = await completeForOwner(page, ticket.id, "Restore access");
    await move(page, "Resolved", true);
    expect((await staffTicket(page, ticket.id)).currentStatus).toBe("RESOLVED");
    await screenshot(page, "workflow", "formally-resolved");
    await move(page, "Closed", true);
    await move(page, "Reopened", true);
    await page.getByRole("button", { name: "Move to Resolved" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("alert")).toContainText("Complete an action for this Ticket before resolving it.");
    expect((await actions(page, ticket.id)).find((action) => action.id === firstActionId)?.status).toBe("COMPLETED");
    await screenshot(page, "workflow", "reopened-old-action-blocked");
    await completeForOwner(page, ticket.id, "Verify reopened issue");
    await move(page, "Resolved", true);
    await page.getByRole("button", { name: "Show history" }).click();
    await expect(page.getByText("STATUS CHANGED").first()).toBeVisible();
    await screenshot(page, "workflow", "history-and-current-cycle-resolution");
  });

  test("rejects a stale Ticket status write and preserves the winning event history", async ({ page, request }) => {
    const ticket = await freshTicket(request, "Status collision");
    await signInReady(page, accounts.narin.email);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await page.getByRole("button", { name: "Claim ticket" }).click();
    const before = await staffTicket(page, ticket.id);
    const historyBefore = await page.request.get(`${apiUrl}/api/staff/tickets/${ticket.id}/workflow-events`);
    expect(historyBefore.status()).toBe(200);
    const priorEvents = (await historyBefore.json()).data as Array<{ id: string }>;
    const external = await page.request.patch(`${apiUrl}/api/staff/tickets/${ticket.id}/status`, { headers: await csrfHeaders(page), data: { version: before.version, status: "OPEN" } });
    expect(external.status(), await external.text()).toBe(200);
    await page.getByRole("button", { name: "Move to Open" }).click();
    await expect(page.getByRole("alert").first()).toContainText("This Ticket changed. Refresh before trying again.");
    const after = await staffTicket(page, ticket.id);
    expect(after.currentStatus).toBe("OPEN");
    const historyAfter = await page.request.get(`${apiUrl}/api/staff/tickets/${ticket.id}/workflow-events`);
    const events = (await historyAfter.json()).data as Array<{ id: string }>;
    expect(events.length).toBe(priorEvents.length + 1);
    expect(events.slice(0, priorEvents.length).map((event) => event.id)).toEqual(priorEvents.map((event) => event.id));
    await screenshot(page, "workflow", "stale-ticket-conflict");
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("button", { name: "Move to In Progress" })).toBeVisible();
  });
});
