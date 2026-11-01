import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { accounts, apiUrl, openMenuIfCollapsed, signInReady, tickets } from "../lab-03/helpers";
import { expectNoOverflow, viewports } from "../lab-03/layout";

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
    await expect(page.getByRole("link", { name: "View my tickets" })).toBeVisible();
    await page.getByRole("link", { name: "View unassigned tickets" }).click();
    await expect(page.getByRole("heading", { name: "Ticket Review" })).toBeVisible();
    await expect(page.getByText(/Read-only administrator view/)).toBeVisible();
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
      await page.getByRole("link", { name: "Clear filters" }).click();
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
