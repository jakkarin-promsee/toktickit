import { expect, test, type Page } from "@playwright/test";
import { accounts, createUser, openMenuIfCollapsed, signIn, signInReady, tickets, unique } from "./helpers";
import { expectNoOverflow, expectTouchTargets, viewports, zoom200, type Viewport } from "./layout";

// RESP-01: every major Lab 3 screen at desktop, tablet, mobile, and the 200% zoom width.
const allSizes: Viewport[] = [...viewports, zoom200];
const isNarrow = (viewport: Viewport) => viewport.width < 768;

async function check(page: Page, viewport: Viewport, screen: string) {
  await expectNoOverflow(page, `${viewport.name} ${screen}`);
  if (viewport.name === "mobile") await expectTouchTargets(page, `${viewport.name} ${screen}`);
}

async function logout(page: Page) {
  await openMenuIfCollapsed(page);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

for (const viewport of allSizes) {
  test.describe(`RESP-01 ${viewport.name} ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("Login and mandatory Change Password fit without overflow, including validation", async ({ page, request }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await check(page, viewport, "login");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText("Email is required.")).toBeVisible();
      await check(page, viewport, "login validation");

      const password = "Responsive!Init-1";
      const user = await createUser(request, { displayName: "Responsive First Login", email: `${unique("resp-first")}@example.test`, role: "REQUESTER", initialPassword: password });
      await signIn(page, user.email, password);
      await expect(page.getByRole("heading", { name: "Change your initial password before continuing" })).toBeVisible();
      await page.getByRole("button", { name: "Change password" }).click();
      await expect(page.getByText("Current password is required.")).toBeVisible();
      await check(page, viewport, "change password validation");
    });

    test("the shell collapses navigation behind a Menu button only below 768 px", async ({ page }) => {
      await signInReady(page, accounts.anan.email);
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      const banner = page.getByRole("banner");
      await expect(banner.getByText(accounts.anan.name)).toBeVisible();
      await expect(banner.getByText("Requester", { exact: true })).toBeVisible();
      if (isNarrow(viewport)) {
        const toggle = page.getByRole("button", { name: "Menu", exact: true });
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(nav).toBeHidden();
        await toggle.click();
        await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
        await expect(nav.getByRole("link", { name: "My Tickets" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
      } else {
        await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeHidden();
        await expect(nav.getByRole("link", { name: "My Tickets" })).toBeVisible();
      }
      await expect(nav.getByRole("link", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
      await check(page, viewport, "requester shell");
    });

    test("Requester screens: My Tickets, Create Ticket, and Ticket Detail with comments", async ({ page }) => {
      await signInReady(page, accounts.pim.email);
      await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
      await check(page, viewport, "my tickets");
      await page.goto("/tickets/new");
      await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
      await page.getByRole("button", { name: "Submit ticket" }).click();
      await expect(page.getByText("Select a category.")).toBeVisible();
      await check(page, viewport, "create ticket validation");
      await page.goto(`/tickets/${tickets.pimWaiting.id}`);
      await expect(page.getByRole("heading", { name: tickets.pimWaiting.summary })).toBeVisible();
      await expect(page.getByLabel("Add public comment")).toBeVisible();
      await check(page, viewport, "requester ticket detail");
    });

    test("Staff Queue shows a table at 768 px and above, and equivalent cards below", async ({ page }) => {
      await signInReady(page, accounts.narin.email);
      await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
      await expect(page.getByText(/^Showing /)).toBeVisible();
      const table = page.getByRole("table");
      const cards = page.locator(".queue-cards");
      if (isNarrow(viewport)) {
        await expect(table).toBeHidden();
        await expect(cards).toBeVisible();
        const card = cards.locator("li").filter({ hasText: tickets.maliOpen.number });
        for (const text of [tickets.maliOpen.summary, "Requester: Mali Srisuk", "Requested: Medium", "IT: High", "Open", "Owner: Narin Support", "Updated"]) await expect(card).toContainText(text);
        await expect(card.getByRole("link", { name: `View ${tickets.maliOpen.number}` })).toBeVisible();
      } else {
        await expect(table).toBeVisible();
        await expect(cards).toBeHidden();
        for (const header of ["Ticket", "Summary", "Priority", "Status", "Owner", "Last updated", "View"]) await expect(table.getByRole("columnheader", { name: header })).toBeVisible();
      }
      await check(page, viewport, "staff queue");
      await page.getByLabel("Search tickets").fill(unique("no-match"));
      await expect(page.getByText("No tickets match")).toBeVisible();
      await check(page, viewport, "staff queue no results");
    });

    test("Staff Ticket Detail keeps workflow cards, tabs, notes, and attachments usable", async ({ page }) => {
      await signInReady(page, accounts.narin.email);
      await page.goto(`/staff/tickets/${tickets.maliOpen.id}`);
      await expect(page.getByRole("heading", { name: tickets.maliOpen.number })).toBeVisible();
      for (const region of ["Ownership", "Priority", "Status"]) await expect(page.getByRole("region", { name: region })).toBeVisible();
      await check(page, viewport, "staff detail public comments");
      await page.getByRole("tab", { name: "Internal Notes" }).click();
      await expect(page.getByLabel("Add internal note")).toBeVisible();
      await check(page, viewport, "staff detail internal notes");
      await page.getByRole("tab", { name: "Attachments" }).click();
      await check(page, viewport, "staff detail attachments");
      await page.getByRole("button", { name: "Move to Cancelled" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Confirm" })).toBeInViewport();
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeInViewport();
      await check(page, viewport, "staff detail confirmation dialog");
      await dialog.getByRole("button", { name: "Cancel" }).click();
    });

    test("User Management list, create panel, and edit panel stay inside the viewport", async ({ page }) => {
      await signInReady(page, accounts.araya.email);
      await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
      if (isNarrow(viewport)) {
        await expect(page.getByRole("table")).toBeHidden();
        const card = page.locator(".user-cards li").filter({ hasText: accounts.narin.email });
        for (const text of [accounts.narin.name, accounts.narin.email, "IT Staff", "Active"]) await expect(card).toContainText(text);
        await expect(card.getByRole("button", { name: `Edit ${accounts.narin.name}` })).toBeVisible();
      } else {
        await expect(page.getByRole("table")).toBeVisible();
      }
      await check(page, viewport, "user list");

      await page.getByRole("button", { name: "Create user" }).first().click();
      const form = page.locator("form.user-panel");
      await form.getByRole("button", { name: "Create user" }).click();
      await expect(page.getByText("Display name must contain 2–100 characters.")).toBeVisible();
      const submit = form.getByRole("button", { name: "Create user" });
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      await check(page, viewport, "create user validation");
      await form.getByRole("button", { name: "Cancel" }).click();

      await page.getByRole("button", { name: `Edit ${accounts.araya.name}` }).locator("visible=true").first().click();
      await expect(page.locator("#user-role")).toBeDisabled();
      await check(page, viewport, "edit self");
      await page.getByRole("button", { name: "Set new initial password" }).click();
      const dialog = page.getByRole("dialog", { name: /Set new initial password/ });
      await expect(dialog.getByRole("button", { name: "Set password" })).toBeVisible();
      await check(page, viewport, "reset password dialog");
    });

    test("Administrator Ticket Review is reachable and read-only at this width", async ({ page }) => {
      await signInReady(page, accounts.araya.email);
      await page.goto("/staff/tickets");
      await expect(page.getByRole("heading", { name: "Ticket Review" })).toBeVisible();
      await expect(page.getByText(/Read-only administrator view/)).toBeVisible();
      await check(page, viewport, "admin ticket review");
      await page.goto(`/staff/tickets/${tickets.maliOpen.id}`);
      await expect(page.getByText("Read-only administrator view")).toBeVisible();
      await expect(page.getByRole("button", { name: /Claim|Reassign|Save IT Priority|Move to/ })).toHaveCount(0);
      await check(page, viewport, "admin ticket detail");
      await logout(page);
    });
  });
}
