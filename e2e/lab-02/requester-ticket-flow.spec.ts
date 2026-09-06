import { expect, test } from "@playwright/test";

const ticketInput = {
  category: "Hardware",
  system: "Corporate Laptop",
  summary: "E2E attachment lifecycle ticket",
  priority: "MEDIUM",
  description: "This ticket proves the complete Lab 2 requester workflow.",
};

test.describe("Lab 2 requester ticket flow", () => {
  test("creates a ticket and manages an attachment", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Select a Development Requester" })).toBeVisible();
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/create-ticket/requester-selection.png",
      fullPage: true,
    });
    await page.getByLabel("Development Requester", { exact: true }).selectOption({ index: 1 });
    const requesterId = await page.getByLabel("Development Requester", { exact: true }).inputValue();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("link", { name: "Create Ticket" }).click();

    await page.getByLabel("Category *").selectOption({ label: ticketInput.category });
    await page.getByLabel("Related System *").selectOption({ label: ticketInput.system });
    await page.getByLabel("Ticket Summary *").fill(ticketInput.summary);
    await page.getByLabel("Requested Priority *").selectOption(ticketInput.priority);
    await page.getByLabel("Description *").fill(ticketInput.description);
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/create-ticket/initial-valid.png",
      fullPage: true,
    });
    await page.getByLabel("Supporting files").setInputFiles({
      name: "invalid.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("unsupported"),
    });
    await expect(page.getByRole("alert")).toContainText("not a supported file");
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/create-ticket/invalid-attachment.png",
      fullPage: true,
    });
    await page.getByLabel("Supporting files").setInputFiles([]);

    await page.route("**/api/tickets", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    });
    const createResponse = page.waitForResponse((response) =>
      response.url().endsWith("/api/tickets") &&
      response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create Ticket" }).click();
    await expect(page.getByRole("button", { name: "Creating ticket…" })).toBeDisabled();
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/create-ticket/submitting.png",
      fullPage: true,
    });
    await createResponse;
    await page.unroute("**/api/tickets");

    const success = page.getByRole("status");
    await expect(success).toContainText("Official Ticket Number:");
    const ticketNumber = (await success.textContent())?.match(/TKT-\d{8}-\d{6}/)?.[0] ?? "";
    expect(ticketNumber).not.toBe("");
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/create-ticket/success.png",
      fullPage: true,
    });

    await page.getByRole("button", { name: "Go to My Tickets" }).click();
    await page.getByRole("textbox", { name: "Search" }).fill(ticketNumber);
    const ticketRow = page.getByRole("row").filter({ hasText: ticketNumber });
    await expect(ticketRow).toBeVisible();
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/my-tickets/filtered-results.png",
      fullPage: true,
    });
    await ticketRow.getByRole("link", { name: "View ticket" }).click();
    await expect(page.getByRole("heading", { name: "Ticket Detail" })).toBeVisible();
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/ticket-detail/owned-ticket.png",
      fullPage: true,
    });

    const file = {
      name: "e2e-evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nE2E evidence"),
    };
    await page.getByLabel("Add attachment").setInputFiles(file);
    await expect(page.getByText("e2e-evidence.pdf")).toBeVisible();
    const apiBase = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";
    const metadata = await request.get(`${apiBase}/api/tickets/${page.url().split("#ticket-")[1]}/attachments`, {
      headers: { "X-Requester-Id": requesterId },
    });
    expect(metadata.status()).toBe(200);
    const attachmentId = (await metadata.json()).data[0].id as string;
    const activeDownload = await request.get(`${apiBase}/api/attachments/${attachmentId}/download`, {
      headers: { "X-Requester-Id": requesterId },
    });
    expect(activeDownload.status()).toBe(200);
    expect((await activeDownload.body()).toString()).toContain("E2E evidence");
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/ticket-detail/active-attachment.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.getByLabel("Removal reason").fill("The E2E evidence is no longer needed.");
    await page.getByRole("button", { name: "Confirm removal" }).click();
    await expect(page.getByText("Unavailable for download")).toBeVisible();
    await expect(page.getByRole("button", { name: "Download" })).toHaveCount(0);
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/ticket-detail/removed-attachment.png",
      fullPage: true,
    });
    const removedDownload = await request.get(`${apiBase}/api/attachments/${attachmentId}/download`, {
      headers: { "X-Requester-Id": requesterId },
    });
    expect(removedDownload.status()).toBe(410);
    expect((await removedDownload.body()).toString()).not.toContain("E2E evidence");
  });

  test("does not expose Requester A data after switching to Requester B", async ({ page, request }) => {
    await page.goto("/");
    await page.getByLabel("Development Requester", { exact: true }).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("link", { name: "Create Ticket" }).click();
    await page.getByLabel("Category *").selectOption({ index: 1 });
    await page.getByLabel("Related System *").selectOption({ index: 1 });
    await page.getByLabel("Ticket Summary *").fill("Requester A isolation ticket");
    await page.getByLabel("Requested Priority *").selectOption("LOW");
    await page.getByLabel("Description *").fill("This ticket must not be visible to Requester B.");
    await page.getByLabel("Supporting files").setInputFiles({
      name: "private-evidence.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nRequester A private bytes"),
    });
    await page.getByRole("button", { name: "Create Ticket" }).click();
    await expect(page.getByRole("status")).toContainText("Official Ticket Number:");
    await page.getByRole("button", { name: "Go to My Tickets" }).click();
    const ticketHref = await page.getByRole("link", { name: "View ticket" }).first().getAttribute("href");
    const ticketId = ticketHref?.replace("#ticket-", "");
    expect(ticketId).toBeTruthy();
    const apiBase = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3000";
    const requesterAId = await page.evaluate(() => localStorage.getItem("toktickit.requesterId"));
    const attachments = await request.get(`${apiBase}/api/tickets/${ticketId}/attachments`, {
      headers: { "X-Requester-Id": requesterAId ?? "" },
    });
    expect(attachments.status()).toBe(200);
    const attachmentId = (await attachments.json()).data[0].id as string;

    await page.getByRole("button", { name: "Change Requester" }).click();
    await page.getByLabel("Development Requester", { exact: true }).selectOption({ index: 2 });
    const requesterBId = await page.getByLabel("Development Requester", { exact: true }).inputValue();
    const listReload = page.waitForResponse((response) =>
      response.url().includes("/api/tickets") && response.request().method() === "GET",
    );
    await page.getByRole("button", { name: "Continue" }).click();
    await listReload;

    const denied = await request.get(`${apiBase}/api/tickets/${ticketId}`, {
      headers: { "X-Requester-Id": requesterBId },
    });
    expect(denied.status()).toBe(404);
    expect(await denied.text()).not.toContain("Requester A isolation ticket");
    const attachmentDenied = await request.get(
      `${apiBase}/api/attachments/${attachmentId}/download`,
      { headers: { "X-Requester-Id": requesterBId } },
    );
    expect(attachmentDenied.status()).toBe(404);
    expect((await attachmentDenied.body()).toString()).not.toContain("Requester A private bytes");
    await expect(page.getByText("Requester A isolation ticket")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
    await page.goto(`/#ticket-${ticketId}`);
    await expect(page.getByText("We couldn't find this ticket.")).toBeVisible();
    await expect(page.getByText("Requester A isolation ticket")).toHaveCount(0);
    await page.screenshot({
      path: "artifacts/lab-02/screenshots/ticket-detail/unauthorized.png",
      fullPage: true,
    });
  });
});
