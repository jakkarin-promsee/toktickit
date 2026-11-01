import { expect, test, type Page } from "@playwright/test";
import { accounts, signInReady, tickets } from "../lab-03/helpers";

const unfinished = /\bTODO\b|Lorem ipsum|Coming soon|Not implemented/i;

async function auditScreen(page: Page, pathname: string, errors: string[]) {
  await page.goto(pathname);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(await page.getByRole("main").innerText()).not.toMatch(unfinished);
  const invalidLinks = await page.locator("main a[href], header a[href]").evaluateAll((links) => links.filter((link) => {
    const href = link.getAttribute("href")?.trim() ?? "";
    return !href || href === "#" || href.startsWith("javascript:");
  }).map((link) => link.outerHTML));
  expect(invalidLinks, `unfinished links on ${pathname}`).toEqual([]);
  expect(errors, `browser errors on ${pathname}`).toEqual([]);
}

test("approved role screens have working local navigation targets, no unfinished copy, and no browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await signInReady(page, accounts.anan.email);
  errors.length = 0;
  await auditScreen(page, "/dashboard", errors);
  await auditScreen(page, "/tickets", errors);
  await auditScreen(page, `/tickets/${tickets.ananNew.id}`, errors);
  await auditScreen(page, "/tickets/new", errors);
  await page.getByRole("button", { name: "Logout" }).click();
  await signInReady(page, accounts.narin.email);
  errors.length = 0;
  await auditScreen(page, "/dashboard", errors);
  await auditScreen(page, "/staff/tickets", errors);
  await auditScreen(page, `/staff/tickets/${tickets.maliOpen.id}`, errors);
  await page.getByRole("button", { name: "Logout" }).click();
  await signInReady(page, accounts.araya.email);
  errors.length = 0;
  await auditScreen(page, "/dashboard", errors);
  await auditScreen(page, "/staff/tickets", errors);
  await auditScreen(page, "/admin/users", errors);
});
