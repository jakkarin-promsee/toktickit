import { expect, test, type Page } from "@playwright/test";
import { accounts, apiSession, apiUrl, signInReady, tickets, unique } from "./helpers";
import { contrastViolations, expectVisibleFocus, structureViolations } from "./layout";

// A11Y-01: keyboard operation, visible focus, dialog focus management, semantics, and contrast.
test.use({ viewport: { width: 1440, height: 900 } });

async function expectClean(page: Page, label: string) {
  expect(await structureViolations(page), `${label}: structure`).toEqual([]);
  expect(await contrastViolations(page), `${label}: contrast under 4.5:1`).toEqual([]);
}

test.describe("A11Y-01 structure and contrast on every major screen", () => {
  test("Login and Change Password", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expectClean(page, "login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expectClean(page, "login validation");
  });

  test("Requester screens", async ({ page }) => {
    await signInReady(page, accounts.pim.email);
    await expectClean(page, "my tickets");
    await page.goto("/tickets/new");
    await page.getByRole("button", { name: "Submit ticket" }).click();
    await expect(page.getByText("Select a category.")).toBeVisible();
    await expectClean(page, "create ticket validation");
    await page.goto(`/tickets/${tickets.pimWaiting.id}`);
    await expect(page.getByRole("heading", { name: tickets.pimWaiting.summary })).toBeVisible();
    await expectClean(page, "requester detail");
  });

  test("Staff Queue and Staff Ticket Detail", async ({ page }) => {
    await signInReady(page, accounts.narin.email);
    await expect(page.getByText(/^Showing /)).toBeVisible();
    await expectClean(page, "staff queue");
    await page.goto(`/staff/tickets/${tickets.maliOpen.id}`);
    await expect(page.getByRole("heading", { name: tickets.maliOpen.number })).toBeVisible();
    await expectClean(page, "staff detail");
    await page.getByRole("tab", { name: "Internal Notes" }).click();
    await page.getByRole("button", { name: "Save internal note" }).click();
    await expect(page.getByText("Note is required.")).toBeVisible();
    await expectClean(page, "staff detail internal notes validation");
  });

  test("User Management and Administrator Ticket Review", async ({ page }) => {
    await signInReady(page, accounts.araya.email);
    await expect(page.getByRole("table")).toBeVisible();
    await expectClean(page, "user list");
    await page.getByRole("button", { name: "Create user" }).first().click();
    await page.locator("form.user-panel").getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expectClean(page, "create user validation");
    await page.goto("/staff/tickets");
    await expect(page.getByRole("heading", { name: "Ticket Review" })).toBeVisible();
    await expectClean(page, "admin ticket review");
  });
});

test.describe("A11Y-01 keyboard walkthroughs", () => {
  test("Login works by keyboard alone, shows visible focus, and focuses the first invalid field", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();
    await expectVisibleFocus(page, "email");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Show password" })).toBeFocused();
    await expectVisibleFocus(page, "show password");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
    await expectVisibleFocus(page, "sign in");
    await page.keyboard.press("Enter");

    const email = page.getByLabel("Email");
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAttribute("aria-required", "true");
    await expect(email).toHaveAccessibleDescription("Email is required.");

    await email.fill(accounts.anan.email);
    await page.getByLabel("Password", { exact: true }).fill(process.env.LAB3_SEED_INITIAL_PASSWORD!);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("the skip link and the shell navigation are keyboard reachable with aria-current", async ({ page }) => {
    await signInReady(page, accounts.anan.email);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "TokTickIT" })).toBeFocused();
    await page.keyboard.press("Tab");
    const myTickets = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "My Tickets" });
    await expect(myTickets).toBeFocused();
    await expectVisibleFocus(page, "nav link on green header");
    await expect(myTickets).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Ticket" })).toHaveAttribute("aria-current", "page");
  });

  test("the mobile menu opens, closes with Escape, and returns focus to the toggle", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInReady(page, accounts.narin.email);
    const toggle = page.getByRole("button", { name: "Menu", exact: true });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Ticket Queue" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toHaveAttribute("aria-expanded", "false");
  });

  test("confirmation dialogs start on Cancel, trap Tab, close on Escape, and restore focus", async ({ page, request }) => {
    const headers = await apiSession(request, accounts.anan.email);
    const created = await request.post(`${apiUrl}/api/tickets`, { headers, data: { categoryId: 1, relatedSystemId: 1, summary: unique("A11y dialog"), requestedPriority: "LOW", description: "Ticket used for the dialog keyboard walkthrough." } });
    const ticket = (await created.json()).data as { id: string; ticketNumber: string };

    await signInReady(page, accounts.narin.email);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await expect(page.getByRole("heading", { name: ticket.ticketNumber })).toBeVisible();
    const trigger = page.getByRole("button", { name: "Move to Cancelled" });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Confirm status change" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toHaveAccessibleDescription(/from New to Cancelled/);
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Confirm" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("communication tabs follow the arrow-key tabs pattern", async ({ page }) => {
    await signInReady(page, accounts.narin.email);
    await page.goto(`/staff/tickets/${tickets.maliOpen.id}`);
    const publicTab = page.getByRole("tab", { name: "Public Comments" });
    await publicTab.focus();
    await expect(publicTab).toHaveAttribute("tabindex", "0");
    await expect(page.getByRole("tab", { name: "Internal Notes" })).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("ArrowRight");
    const internalTab = page.getByRole("tab", { name: "Internal Notes" });
    await expect(internalTab).toBeFocused();
    await expect(internalTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("Visible only to IT Staff and Administrators");
    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "Attachments" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(publicTab).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Attachments" })).toHaveAttribute("aria-selected", "true");
  });

  test("User Management form errors are announced and the reset dialog focuses its first field", async ({ page }) => {
    await signInReady(page, accounts.araya.email);
    await page.getByRole("button", { name: "Create user" }).first().click();
    await expect(page.getByLabel("Display name")).toBeFocused();
    await page.getByLabel("Email", { exact: true }).fill("not-an-email");
    await page.locator("form.user-panel").getByRole("button", { name: "Create user" }).click();
    const name = page.getByLabel("Display name");
    await expect(name).toBeFocused();
    await expect(name).toHaveAccessibleDescription("Display name must contain 2–100 characters.");
    await expect(page.getByLabel("Email", { exact: true })).toHaveAccessibleDescription("Enter a valid email address.");
    await page.locator("form.user-panel").getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog", { name: "Discard changes?" }).getByRole("button", { name: "Discard" }).click();

    await page.getByRole("table").getByRole("button", { name: `Edit ${accounts.anan.name}` }).click();
    const resetTrigger = page.getByRole("button", { name: "Set new initial password" });
    await resetTrigger.click();
    const dialog = page.getByRole("dialog", { name: /Set new initial password for Anan Chai/ });
    await expect(dialog.getByLabel("New initial password", { exact: true })).toBeFocused();
    await expect(dialog).toHaveAccessibleDescription(/All current sessions for this user will end/);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(resetTrigger).toBeFocused();
  });
});
