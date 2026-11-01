import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { accounts, apiUrl, openMenuIfCollapsed, signInReady, tickets } from "../lab-03/helpers";
import { expectNoOverflow, viewports } from "../lab-03/layout";
import { screenshot } from "./helpers";

test.describe("Lab 4 role dashboards", () => {
  test("Dashboard loading and safe failure hide counts until Retry succeeds", async ({ page }) => {
    await signInReady(page, accounts.anan.email);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/dashboard/requester", async (route) => { await gate; await route.fulfill({ status: 503, json: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Dashboard unavailable." } } }); });
    await page.goto("/dashboard");
    await expect(page.getByRole("status")).toHaveText("Loading dashboard…");
    release();
    await expect(page.getByRole("alert")).toContainText("Dashboard could not be loaded");
    await expect(page.getByRole("link", { name: "View open tickets" })).toHaveCount(0);
    await page.unroute("**/api/dashboard/requester");
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("link", { name: "View open tickets" })).toBeVisible();
  });
  test("Administrator reuses Staff metrics and reaches read-only Ticket Review", async ({ page }) => {
    await signInReady(page, accounts.araya.email);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await screenshot(page, "staff-dashboard", "administrator-desktop");
    await expect(page.getByRole("link", { name: "View my tickets" })).toBeVisible();
    await page.getByRole("link", { name: "View unassigned tickets" }).click();
    await expect(page.getByRole("heading", { name: "Ticket Review" })).toBeVisible();
    await expect(page.getByText(/Read-only administrator view/)).toBeVisible();
  });
  test("dashboard UI matches role-scoped query results, including current-user Actions and recent/urgent Tickets", async ({ page }) => {
    await signInReady(page, accounts.anan.email);
    await page.goto("/dashboard");
    const requesterResponse = await page.request.get(`${apiUrl}/api/dashboard/requester`);
    expect(requesterResponse.status()).toBe(200);
    const requester = (await requesterResponse.json()).data;
    for (const [label, field] of [["Open Tickets", "openTickets"], ["Waiting for You", "waitingForYou"], ["Recently Updated", "recentlyUpdated"], ["Recently Resolved", "recentlyResolved"]] as const) {
      await expect(page.locator(".dashboard-card").filter({ has: page.getByRole("heading", { name: label }) }).locator("strong")).toHaveText(String(requester.cards[field]));
    }
    const deniedStaff = await page.request.get(`${apiUrl}/api/dashboard/staff`);
    expect(deniedStaff.status()).toBe(403);
    for (const item of requester.recentTickets) await expect(page.getByRole("link", { name: new RegExp(item.ticketNumber) })).toBeVisible();
    const crossOwner = await page.request.get(`${apiUrl}/api/tickets/${tickets.maliOpen.id}`);
    expect(crossOwner.status()).toBe(404);
    await openMenuIfCollapsed(page);
    await page.getByRole("button", { name: "Logout" }).click();
    await signInReady(page, accounts.narin.email);
    await page.goto("/dashboard");
    const response = await page.request.get(`${apiUrl}/api/dashboard/staff`);
    expect(response.status()).toBe(200);
    const staff = (await response.json()).data;
    for (const [label, field] of [["Unassigned Tickets", "unassignedTickets"], ["My Tickets", "myTickets"], ["My Active Actions", "myActiveActions"]] as const) {
      await expect(page.locator(".dashboard-card").filter({ has: page.getByRole("heading", { name: label }) }).locator("strong")).toHaveText(String(staff.cards[field]));
    }
    for (const [view, items] of [["urgent", staff.urgentTickets], ["recent-updated", staff.recentTickets]] as const) {
      const params = new URLSearchParams({ view, ...(view === "recent-updated" ? { from: staff.windowStart, through: staff.asOf } : {}) });
      const query = await page.request.get(`${apiUrl}/api/staff/tickets?${params}`);
      expect(query.status()).toBe(200);
      const ids = new Set(((await query.json()).data as Array<{ id: string }>).map((item) => item.id));
      for (const item of items) { expect(ids.has(item.id), `${view}: ${item.id}`).toBe(true); await expect(page.getByRole("link", { name: new RegExp(item.ticketNumber) }).first()).toBeVisible(); }
    }
    const actionQuery = await page.request.get(`${apiUrl}/api/staff/tickets?view=my-active-actions`);
    expect(actionQuery.status()).toBe(200);
    const actionTickets = new Set(((await actionQuery.json()).data as Array<{ id: string; matchingActionCount: number }>).filter((item) => item.matchingActionCount > 0).map((item) => item.id));
    for (const action of staff.myActions as Array<{ id: string; ticketId: string; description: string }>) {
      expect(actionTickets.has(action.ticketId)).toBe(true);
      await expect(page.getByRole("link", { name: new RegExp(action.description) })).toHaveAttribute("href", `/staff/tickets/${action.ticketId}#action-${action.id}`);
    }
    expect((await page.request.get(`${apiUrl}/api/dashboard/requester`)).status()).toBe(403);
  });
  for (const viewport of viewports) {
    test(`${viewport.name}: requester and staff dashboard drill-down`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signInReady(page, accounts.anan.email);
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expect(page.getByRole("link", { name: "View open tickets" })).toBeVisible();
      await expectNoOverflow(page, `requester dashboard ${viewport.name}`);
      mkdirSync("artifacts/lab-04/screenshots/requester-dashboard", { recursive: true });
      await page.screenshot({ path: `artifacts/lab-04/screenshots/requester-dashboard/${viewport.name}.png`, fullPage: true, animations: "disabled" });
      await page.getByRole("link", { name: "View open tickets" }).click();
      await expect(page).toHaveURL(/\/tickets\?view=open$/);
      await expect(page.getByText("Filter: open")).toBeVisible();
      await page.getByRole("button", { name: "Clear filters" }).click();
      await expect(page).toHaveURL(/\/tickets$/);
      await expect(page.getByText("Filter: open")).toHaveCount(0);
      const crossOwner = await page.request.get(`${apiUrl}/api/tickets/${tickets.maliOpen.id}`);
      expect(crossOwner.status()).toBe(404);
      await openMenuIfCollapsed(page);
      await page.getByRole("button", { name: "Logout" }).click();
      await signInReady(page, accounts.narin.email);
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expect(page.getByRole("link", { name: "View my active actions" })).toBeVisible();
      await expectNoOverflow(page, `staff dashboard ${viewport.name}`);
      mkdirSync("artifacts/lab-04/screenshots/staff-dashboard", { recursive: true });
      await page.screenshot({ path: `artifacts/lab-04/screenshots/staff-dashboard/${viewport.name}.png`, fullPage: true, animations: "disabled" });
      await page.getByRole("link", { name: "View unassigned tickets" }).click();
      await expect(page).toHaveURL(/\/staff\/tickets\?view=unassigned$/);
      await expect(page.getByText("Filter: unassigned")).toBeVisible();
    });
  }
});
