import { expect, test } from "@playwright/test";

test("keyboard users can select a requester and reach the ticket workflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByLabel("Development Requester", { exact: true }).focus();
  await expect(page.getByLabel("Development Requester", { exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  await page.getByRole("link", { name: "Create Ticket" }).focus();
  await expect(page.getByRole("link", { name: "Create Ticket" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
  await expect(page.getByLabel("Ticket Summary *")).toHaveAttribute("aria-required", "true");
  await page.getByRole("button", { name: "Create Ticket" }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  expect(await page.getByRole("button", { name: "Create Ticket" }).evaluate(
    (element) => element.matches(":focus-visible"),
  )).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByLabel("Ticket Summary *")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Category *")).toBeFocused();
  await page.screenshot({
    path: "artifacts/lab-02/screenshots/create-ticket/validation-failure.png",
    fullPage: true,
  });

  await page.getByLabel("Category *").selectOption({ index: 1 });
  await page.getByLabel("Related System *").selectOption({ index: 1 });
  await page.getByLabel("Ticket Summary *").fill("Keyboard attachment workflow");
  await page.getByLabel("Requested Priority *").selectOption("LOW");
  await page.getByLabel("Description *").fill("Keyboard users can complete this workflow.");
  await page.getByRole("button", { name: "Create Ticket" }).click();
  const success = page.getByRole("status");
  await expect(success).toContainText("Official Ticket Number:");
  const ticketNumber = (await success.textContent())?.match(/TKT-\d{8}-\d{6}/)?.[0] ?? "";
  await page.getByRole("button", { name: "Go to My Tickets" }).click();
  await page.getByRole("textbox", { name: "Search" }).fill(ticketNumber);
  const ticketRow = page.getByRole("row").filter({ hasText: ticketNumber });
  await expect(ticketRow).toBeVisible();
  await ticketRow.getByRole("link", { name: "View ticket" }).click();
  await page.getByLabel("Add attachment").setInputFiles({
    name: "keyboard-evidence.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nKeyboard evidence"),
  });
  const removeButton = page.getByRole("button", { name: "Remove" });
  await expect(removeButton).toBeVisible();
  await removeButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Remove attachment?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByLabel("Removal reason")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(removeButton).toBeFocused();
});
