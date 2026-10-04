import { expect, test } from "@playwright/test";
import { accounts, apiUrl, csrfHeaders, signInReady, tickets, unique } from "./helpers";

const seededInternalNote = "Compare the affected rooms against the latest access-point health report.";

test.describe("E2E-02 Requester workflow with authenticated identity", () => {
  test("creates a Ticket as the signed-in Requester with no selectable identity", async ({ page }) => {
    const summary = unique("E2E VPN issue");
    await signInReady(page, accounts.anan.email);
    await expect(page.getByText(/Change Requester/i)).toHaveCount(0);
    await page.getByRole("link", { name: "Create Ticket" }).click();
    await expect(page.getByRole("heading", { name: "Create Ticket" })).toBeVisible();
    await page.getByLabel("Category").selectOption({ label: "Network" });
    await page.getByLabel("Related System").selectOption({ label: "VPN" });
    await page.getByLabel("Summary").fill(summary);
    await page.getByLabel("Description").fill("The VPN disconnects every few minutes during the E2E run.");
    await page.getByRole("button", { name: "Submit ticket" }).click();
    await expect(page.getByRole("heading", { name: summary })).toBeVisible();
    await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}$/);

    await page.getByRole("link", { name: "My Tickets", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(summary) }).first()).toBeVisible();
    await expect(page.getByText(tickets.maliOpen.summary)).toHaveCount(0);
  });

  test("posts a Public Comment and indicates the problem appears resolved without changing status", async ({ page }) => {
    const comment = unique("Thanks, the course page loads now");
    await signInReady(page, accounts.pim.email);
    await page.goto(`/tickets/${tickets.pimWaiting.id}`);
    await expect(page.getByRole("heading", { name: tickets.pimWaiting.summary })).toBeVisible();
    await expect(page.getByText(/internal note/i)).toHaveCount(0);
    await expect(page.getByText(seededInternalNote)).toHaveCount(0);

    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("Comment is required.")).toBeVisible();
    await page.getByLabel("Add public comment").fill(comment);
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("Comment posted.")).toBeVisible();
    await expect(page.getByText(comment)).toBeVisible();

    await page.getByRole("button", { name: "Problem appears resolved" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/support must still resolve or close the Ticket/i)).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/You indicated the problem appears resolved/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Problem appears resolved" })).toHaveCount(0);
    await expect(page.getByText("Waiting for Requester").first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(comment)).toBeVisible();
  });

  test("never shows another Requester's Ticket or any Internal Note, through the UI or direct API", async ({ page }) => {
    await signInReady(page, accounts.anan.email);
    await page.goto(`/tickets/${tickets.maliOpen.id}`);
    await expect(page.getByText("We couldn't find this ticket.")).toBeVisible();
    await expect(page.getByText(tickets.maliOpen.summary)).toHaveCount(0);

    const headers = await csrfHeaders(page);
    const otherOwner = await page.request.get(`${apiUrl}/api/tickets/${tickets.maliOpen.id}`);
    const missing = await page.request.get(`${apiUrl}/api/tickets/00000000-0000-4000-8000-000000000000`);
    expect(otherOwner.status()).toBe(404);
    expect(await otherOwner.json()).toEqual(await missing.json());

    const forgedList = await page.request.get(`${apiUrl}/api/tickets`, { headers: { "X-Requester-Id": "2" } });
    expect(forgedList.status()).toBe(200);
    expect(await forgedList.text()).not.toContain(tickets.maliOpen.number);

    const crossComment = await page.request.post(`${apiUrl}/api/tickets/${tickets.maliOpen.id}/comments`, { headers, data: { content: "Should never be stored." } });
    expect(crossComment.status()).toBe(404);

    for (const response of [
      await page.request.get(`${apiUrl}/api/staff/tickets/${tickets.maliOpen.id}/internal-notes`),
      await page.request.post(`${apiUrl}/api/staff/tickets/${tickets.maliOpen.id}/internal-notes`, { headers, data: { content: "Requester note attempt." } }),
      await page.request.get(`${apiUrl}/api/staff/tickets/${tickets.maliOpen.id}`),
    ]) {
      expect(response.status()).toBe(403);
      const text = await response.text();
      expect(text).not.toContain(seededInternalNote);
      expect(text).not.toContain(tickets.maliOpen.summary);
    }
  });
});
