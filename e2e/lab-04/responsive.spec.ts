import { expect, test } from "@playwright/test";
import { accounts, openMenuIfCollapsed, signInReady, tickets } from "../lab-03/helpers";
import { expectNoOverflow, expectTouchTargets, viewports, zoom200 } from "../lab-03/layout";
import { screenshot } from "./helpers";

for (const viewport of [...viewports, zoom200]) {
  test(`${viewport.name}: dashboards, workflow, and Action list/create/edit/assign/read-only modes fit`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const check = async (label: string) => { await expectNoOverflow(page, `${viewport.name} ${label}`); if (viewport.name === "mobile") await expectTouchTargets(page, `${viewport.name} ${label}`); };
    await signInReady(page, accounts.narin.email);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "View my active actions" })).toBeVisible();
    await check("staff dashboard");
    await page.goto(`/staff/tickets/${tickets.maliOpen.id}`);
    await expect(page.getByRole("heading", { name: tickets.maliOpen.number })).toBeVisible();
    await expect(page.getByRole("button", { name: "Move to In Progress" })).toBeVisible();
    await check("staff workflow and Action list");
    if (viewport.name !== "zoom-200") await screenshot(page, "actions-taken", `${viewport.name}-staff-list-and-workflow`);
    await page.getByRole("button", { name: "Add action" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await check("Action create dialog");
    if (viewport.name !== "zoom-200") await screenshot(page, "actions-taken", `${viewport.name}-create-mode`, viewport.name !== "mobile");
    if (viewport.name === "mobile") { await page.getByRole("dialog").getByRole("button", { name: "Add action" }).scrollIntoViewIfNeeded(); await expect(page.getByRole("dialog").getByRole("button", { name: "Add action" })).toBeInViewport(); await screenshot(page, "actions-taken", "mobile-create-mode-submit", false); }
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    const row = page.locator("#action-34a00000-0000-4000-8000-000000000002");
    await row.getByRole("button", { name: "View action" }).click();
    await check("Action details");
    await row.getByRole("button", { name: "Edit action" }).click();
    await check("Action edit dialog");
    if (viewport.name !== "zoom-200") await screenshot(page, "actions-taken", `${viewport.name}-edit-mode`, viewport.name !== "mobile");
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await row.getByRole("button", { name: "Reassign" }).click();
    await check("Action assign dialog");
    if (viewport.name !== "zoom-200") await screenshot(page, "actions-taken", `${viewport.name}-assign-mode`, viewport.name !== "mobile");
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await openMenuIfCollapsed(page);
    await page.getByRole("button", { name: "Logout" }).click();
    await signInReady(page, accounts.mali.email);
    await page.goto(`/tickets/${tickets.maliOpen.id}`);
    await expect(page.getByRole("heading", { name: tickets.maliOpen.summary })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add action" })).toHaveCount(0);
    await row.getByRole("button", { name: "View action" }).click();
    await check("Requester read-only Actions");
    if (viewport.name !== "zoom-200") await screenshot(page, "actions-taken", `${viewport.name}-requester-read-only`);
  });
}
