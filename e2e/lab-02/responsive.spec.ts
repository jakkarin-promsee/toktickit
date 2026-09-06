import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const apiBase = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";
const responsiveSummary = "Responsive evidence ticket";
let requesterId = "";

async function assertNoPageOverflow(page: import("@playwright/test").Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(width);
  const clippedControls = await page.locator("button:visible, a:visible, input:visible, select:visible, textarea:visible")
    .evaluateAll((elements, viewportWidth) => elements.filter((element) => {
      const rectangle = element.getBoundingClientRect();
      return rectangle.left < -1 || rectangle.right > viewportWidth + 1;
    }).length, width);
  expect(clippedControls).toBe(0);
}

test.describe("Lab 2 responsive integration", () => {
  test.beforeAll(async ({ request }) => {
    const requesters = await request.get(`${apiBase}/api/requesters`);
    const categories = await request.get(`${apiBase}/api/categories`);
    const systems = await request.get(`${apiBase}/api/related-systems`);
    requesterId = String((await requesters.json()).data[2].id);
    const categoryId = (await categories.json())[0].id;
    const relatedSystemId = (await systems.json())[0].id;
    const created = await request.post(`${apiBase}/api/tickets`, {
      headers: { "X-Requester-Id": requesterId },
      data: {
        categoryId,
        relatedSystemId,
        summary: responsiveSummary,
        requestedPriority: "HIGH",
        description: "This ticket verifies every responsive Lab 2 screen.",
      },
    });
    expect(created.status()).toBe(201);
  });

  for (const viewport of viewports) {
    test(`${viewport.name} has no overflow across all requester screens`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");

      await expect(page.getByRole("heading", { name: "Select a Development Requester" })).toBeVisible();
      await assertNoPageOverflow(page, viewport.width);

      await page.getByLabel("Development Requester", { exact: true }).selectOption(requesterId);
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
      await page.getByRole("textbox", { name: "Search" }).fill(responsiveSummary);
      const visibleResult = viewport.width < 768
        ? page.getByRole("article").filter({ hasText: responsiveSummary }).first()
        : page.getByRole("row").filter({ hasText: responsiveSummary }).first();
      await expect(visibleResult).toBeVisible();

      if (viewport.width < 768) {
        await expect(page.getByRole("article").filter({ hasText: responsiveSummary }).first()).toContainText(
          "Requested Priority: HIGH",
        );
        await expect(page.getByRole("table")).toBeHidden();
        await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
        await page.getByRole("button", { name: "Open menu" }).click();
        await expect(page.getByRole("link", { name: "Create Ticket" })).toBeVisible();
      } else {
        await expect(page.getByRole("table")).toBeVisible();
        await expect(page.getByRole("link", { name: "Create Ticket" })).toBeVisible();
      }
      await assertNoPageOverflow(page, viewport.width);

      await page.screenshot({
        path: `artifacts/lab-02/screenshots/my-tickets/${viewport.name}-my-tickets.png`,
        fullPage: true,
      });

      await page.getByRole("link", { name: "Create Ticket" }).click();
      await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
      await assertNoPageOverflow(page, viewport.width);
      await page.screenshot({
        path: `artifacts/lab-02/screenshots/create-ticket/${viewport.name}-create-ticket.png`,
        fullPage: true,
      });

      await page.getByRole("button", { name: "Back to My Tickets" }).click();
      await page.getByRole("textbox", { name: "Search" }).fill(responsiveSummary);
      const visibleSearchResult = viewport.width < 768
        ? page.getByRole("article").filter({ hasText: responsiveSummary }).first()
        : page.getByRole("row").filter({ hasText: responsiveSummary }).first();
      await expect(visibleSearchResult).toBeVisible();
      const result = viewport.width < 768
        ? page.getByRole("article").filter({ hasText: responsiveSummary }).first()
        : page.getByRole("row").filter({ hasText: responsiveSummary }).first();
      await result.getByRole("link", { name: "View ticket" }).click();
      await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
      await assertNoPageOverflow(page, viewport.width);
      await page.screenshot({
        path: `artifacts/lab-02/screenshots/ticket-detail/${viewport.name}-ticket-detail.png`,
        fullPage: true,
      });
    });
  }
});
