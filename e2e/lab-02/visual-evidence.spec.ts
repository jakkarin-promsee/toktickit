import { expect, test } from "@playwright/test";

const apiBase = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";

test.describe.serial("Lab 2 visual state evidence", () => {
  test("captures Requester loading and failure states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route("**/api/requesters", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await page.goto("/");
    await expect(page.getByText("Loading active Requesters…")).toBeVisible();
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/create-ticket/requester-loading.png",
      fullPage: true,
    });
    await expect(page.getByLabel("Development Requester", { exact: true })).toBeEnabled();

    await page.unroute("**/api/requesters");
    await page.route("**/api/requesters", (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "DEPENDENCY_UNAVAILABLE", message: "Requesters are unavailable." },
      }),
    }));
    await page.reload();
    await expect(page.getByRole("alert")).toContainText("We couldn't load Requesters");
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/create-ticket/requester-failure.png",
      fullPage: true,
    });
  });

  test("captures Create Ticket API failure with retained values", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByLabel("Development Requester", { exact: true }).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("link", { name: "Create Ticket" }).click();
    await page.getByLabel("Category *").selectOption({ index: 1 });
    await page.getByLabel("Related System *").selectOption({ index: 1 });
    await page.getByLabel("Ticket Summary *").fill("Retained API failure evidence");
    await page.getByLabel("Requested Priority *").selectOption("HIGH");
    await page.getByLabel("Description *").fill("These entered values must survive the safe API failure.");
    await page.route("**/api/tickets", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "DEPENDENCY_UNAVAILABLE", message: "Database unavailable." },
        }),
      });
    });
    await page.getByRole("button", { name: "Create Ticket" }).click();
    await expect(page.getByRole("alert")).toContainText("We couldn't create the ticket");
    await expect(page.getByLabel("Ticket Summary *")).toHaveValue("Retained API failure evidence");
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/create-ticket/api-failure.png",
      fullPage: true,
    });
  });

  test("captures My Tickets pagination, filtering, no-results, and empty states", async ({
    page,
    request,
  }) => {
    const requestersResponse = await request.get(`${apiBase}/api/requesters`);
    const requesters = (await requestersResponse.json()).data as Array<{ id: number }>;
    const categoriesResponse = await request.get(`${apiBase}/api/categories`);
    const systemsResponse = await request.get(`${apiBase}/api/related-systems`);
    const categoryId = (await categoriesResponse.json())[0].id as number;
    const relatedSystemId = (await systemsResponse.json())[0].id as number;
    const resultsRequester = requesters[3].id;
    const emptyRequester = requesters[1].id;

    for (let index = 0; index < 11; index += 1) {
      const created = await request.post(`${apiBase}/api/tickets`, {
        headers: { "X-Requester-Id": String(resultsRequester) },
        data: {
          categoryId,
          relatedSystemId,
          summary: `Pagination evidence ${String(index + 1).padStart(2, "0")}`,
          requestedPriority: "MEDIUM",
          description: "This ticket provides search, filter, sort, and pagination evidence.",
        },
      });
      expect(created.status()).toBe(201);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByLabel("Development Requester", { exact: true }).selectOption(String(resultsRequester));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/Page 1 of 2 \(\d+ total\)/)).toBeVisible();
    await page.getByLabel("Category").selectOption(String(categoryId));
    await page.getByLabel("Sort by").selectOption("summary");
    await page.getByLabel("Sort order").selectOption("asc");
    await expect(page.getByText("Pagination evidence 01").first()).toBeVisible();
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/my-tickets/filter-sort-pagination.png",
      fullPage: true,
    });

    await page.getByRole("textbox", { name: "Search" }).fill("no ticket can match this phrase");
    await expect(page.getByText("No tickets match your search and filters.")).toBeVisible();
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/my-tickets/no-results.png",
      fullPage: true,
    });

    await page.getByRole("button", { name: "Change Requester" }).click();
    await page.getByLabel("Development Requester", { exact: true }).selectOption(String(emptyRequester));
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("You have no tickets yet.")).toBeVisible();
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/my-tickets/empty.png",
      fullPage: true,
    });
  });
});
