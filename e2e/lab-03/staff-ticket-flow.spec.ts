import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { accounts, apiSession, apiUrl, csrfHeaders, signInReady, tickets, unique } from "./helpers";

// 1×1 transparent PNG, valid signature for the Attachment validator.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

/** Creates Tickets as a Requester through the real API so each test owns its own data. */
async function createTickets(request: APIRequestContext, summaryPrefix: string, count: number) {
  const headers = await apiSession(request, accounts.anan.email);
  const created: { id: string; ticketNumber: string; summary: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    const summary = `${summaryPrefix} ${String(index + 1).padStart(2, "0")}`;
    const response = await request.post(`${apiUrl}/api/tickets`, { headers, data: { categoryId: 1, relatedSystemId: 1, summary, requestedPriority: "MEDIUM", description: "Created by the Lab 3 staff E2E workflow fixture." } });
    expect(response.status(), await response.text()).toBe(201);
    const { data } = await response.json();
    created.push({ id: data.id, ticketNumber: data.ticketNumber, summary });
  }
  return { headers, created };
}

async function queueTicketNumbers(page: Page) {
  const text = await page.getByRole("table").innerText();
  return text.match(/TKT-\d{8}-\d{6}/g) ?? [];
}

test.describe("E2E-03 IT Staff Ticket Queue", () => {
  test("shows realistic shared data with owner and status, and supports search, filters, and sorting", async ({ page }) => {
    await signInReady(page, accounts.narin.email);
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    const table = page.getByRole("table");
    await expect(table.getByText(tickets.ananNew.number)).toBeVisible();
    await expect(table.getByText(tickets.maliOpen.number)).toBeVisible();
    await expect(table.getByText("Unassigned").first()).toBeVisible();
    await expect(table.getByText(accounts.narin.name).first()).toBeVisible();
    await expect(table.getByText("Waiting for Requester").first()).toBeVisible();

    await page.getByLabel("Search tickets").fill("Wi-Fi disconnects");
    await expect(table.getByText(tickets.maliOpen.number)).toBeVisible();
    await expect(table.getByText(tickets.ananNew.number)).toHaveCount(0);
    await expect(page).toHaveURL(/search=Wi-Fi/);

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await page.getByLabel("Owner").selectOption("unassigned");
    await expect(table.getByText(tickets.ananNew.number)).toBeVisible();
    await expect(table.getByText(tickets.maliOpen.number)).toHaveCount(0);

    await page.getByLabel("Status").selectOption("NEW");
    await expect(table.getByText(tickets.ananNew.number)).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await page.getByLabel("Search tickets").fill("TKT-20261004-3100");
    await page.getByLabel("Sort by").selectOption("ticketNumber");
    await page.getByLabel("Direction").selectOption("asc");
    await expect(page).toHaveURL(/sortOrder=asc/);
    await expect.poll(async () => (await queueTicketNumbers(page))[0]).toBe("TKT-20261004-310001");
    await page.getByLabel("Direction").selectOption("desc");
    await expect.poll(async () => (await queueTicketNumbers(page))[0]).toBe("TKT-20261004-310008");
  });

  test("paginates a larger result set and opens Ticket Detail from the queue", async ({ page, request }) => {
    const prefix = unique("E2E paging");
    await createTickets(request, prefix, 12);
    await signInReady(page, accounts.narin.email);
    await page.getByLabel("Search tickets").fill(prefix);
    await page.getByLabel("Page size").selectOption("10");
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(page.getByText("Showing 1–10 of 12")).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await expect(page.getByText("Showing 11–12 of 12")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

    const firstNumber = (await queueTicketNumbers(page))[0];
    await page.getByRole("table").getByRole("link", { name: `View ${firstNumber}` }).click();
    await expect(page.getByRole("heading", { name: firstNumber })).toBeVisible();
    await expect(page).toHaveURL(/\/staff\/tickets\/[0-9a-f-]{36}$/);
  });

  test("shows a no-results state", async ({ page }) => {
    await signInReady(page, accounts.narin.email);
    await page.getByLabel("Search tickets").fill(unique("nothing-matches"));
    await expect(page.getByText("No tickets match")).toBeVisible();
  });
});

test.describe("E2E-03 IT Staff Ticket Detail operations", () => {
  test("claims, reassigns, sets IT Priority, moves through permitted statuses, and keeps comments and notes separate", async ({ page, request }) => {
    const { headers: requesterHeaders, created } = await createTickets(request, unique("E2E staff flow"), 1);
    const ticket = created[0];
    const upload = await request.post(`${apiUrl}/api/tickets/${ticket.id}/attachments`, { headers: requesterHeaders, multipart: { file: { name: "e2e-screenshot.png", mimeType: "image/png", buffer: png } } });
    expect(upload.status(), await upload.text()).toBe(201);

    await signInReady(page, accounts.narin.email);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await expect(page.getByRole("heading", { name: ticket.ticketNumber })).toBeVisible();
    await expect(page.getByText(/Requested Priority \(read-only\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Move to Resolved" })).toHaveCount(0);

    await page.getByRole("button", { name: "Claim ticket" }).click();
    await expect(page.getByText("You now own this Ticket.")).toBeVisible();

    await page.getByLabel("Reassign to").selectOption({ label: accounts.kanda.name });
    await page.getByRole("button", { name: "Reassign" }).click();
    const reassign = page.getByRole("dialog");
    await expect(reassign.getByText(new RegExp(`from ${accounts.narin.name} to ${accounts.kanda.name}`))).toBeVisible();
    await reassign.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(`Ticket assigned to ${accounts.kanda.name}.`)).toBeVisible();

    await page.getByLabel("IT Priority").selectOption("HIGH");
    await page.getByRole("button", { name: "Save IT Priority" }).click();
    await expect(page.getByText("IT Priority saved.")).toBeVisible();

    await page.getByRole("button", { name: "Move to Open" }).click();
    await expect(page.getByText("Status changed to Open.")).toBeVisible();
    await page.getByRole("button", { name: "Move to In Progress" }).click();
    await expect(page.getByText("Status changed to In Progress.")).toBeVisible();
    await page.getByRole("button", { name: "Move to Resolved" }).click();
    const resolve = page.getByRole("dialog");
    await expect(resolve.getByText(/from In Progress to Resolved/)).toBeVisible();
    await resolve.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Status changed to Resolved.")).toBeVisible();

    const publicText = unique("We replaced the mailbox permission set");
    const noteText = unique("Internal: permission group rebuilt");
    await page.getByLabel("Add public comment").fill(publicText);
    await page.getByRole("button", { name: "Post public comment" }).click();
    await expect(page.getByText(publicText)).toBeVisible();
    await page.getByRole("tab", { name: "Internal Notes" }).click();
    await expect(page.getByText(/Visible only to IT Staff and Administrators/)).toBeVisible();
    await page.getByLabel("Add internal note").fill(noteText);
    await page.getByRole("button", { name: "Save internal note" }).click();
    await expect(page.getByText("Internal note saved.")).toBeVisible();
    await expect(page.getByText(noteText)).toBeVisible();

    await page.getByRole("tab", { name: "Attachments" }).click();
    const attachmentLink = page.getByRole("link", { name: "e2e-screenshot.png" });
    await expect(attachmentLink).toBeVisible();
    const download = await page.request.get((await attachmentLink.getAttribute("href"))!);
    expect(download.status()).toBe(200);
    expect(Buffer.from(await download.body()).equals(png)).toBe(true);
    await expect(page.getByRole("button", { name: /upload|remove/i })).toHaveCount(0);

    // The owning Requester sees the Public Comment and the new status, never the Internal Note.
    const requesterView = await request.get(`${apiUrl}/api/tickets/${ticket.id}/comments`);
    expect(requesterView.status()).toBe(200);
    const requesterText = await requesterView.text();
    expect(requesterText).toContain(publicText);
    expect(requesterText).not.toContain(noteText);
    const requesterDetail = await request.get(`${apiUrl}/api/tickets/${ticket.id}`);
    expect(await requesterDetail.text()).not.toContain(noteText);
  });

  test("rejects a forbidden transition and a stale update safely, without changing the Ticket", async ({ page, request }) => {
    const { created } = await createTickets(request, unique("E2E invalid transition"), 1);
    const ticket = created[0];
    await signInReady(page, accounts.narin.email);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await expect(page.getByRole("heading", { name: ticket.ticketNumber })).toBeVisible();
    const headers = await csrfHeaders(page);

    const skip = await page.request.patch(`${apiUrl}/api/staff/tickets/${ticket.id}/status`, { headers, data: { status: "CLOSED", confirmed: true, version: 0 } });
    expect(skip.status()).toBe(409);
    expect((await skip.json()).error.code).toBe("INVALID_STATUS_TRANSITION");

    // Another Staff member changes the Ticket in the background, so the open page now holds a stale version.
    const otherStaff = await apiSession(request, accounts.kanda.email);
    const background = await request.patch(`${apiUrl}/api/staff/tickets/${ticket.id}/it-priority`, { headers: otherStaff, data: { itPriority: "LOW", version: 0 } });
    expect(background.status()).toBe(200);

    await page.getByLabel("IT Priority").selectOption("HIGH");
    await page.getByRole("button", { name: "Save IT Priority" }).click();
    await expect(page.getByText("This Ticket changed. Refresh before trying again.").first()).toBeVisible();
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByLabel("IT Priority")).toHaveValue("LOW");

    const detail = await page.request.get(`${apiUrl}/api/staff/tickets/${ticket.id}`);
    const { data } = await detail.json();
    expect(data.currentStatus).toBe("NEW");
    expect(data.itPriority).toBe("LOW");
  });

  test("keeps the Administrator read-only on Ticket operations through direct API calls", async ({ page }) => {
    await signInReady(page, accounts.araya.email);
    const headers = await csrfHeaders(page);
    const readable = await page.request.get(`${apiUrl}/api/staff/tickets/${tickets.maliOpen.id}`);
    expect(readable.status()).toBe(200);
    for (const response of [
      await page.request.post(`${apiUrl}/api/staff/tickets/${tickets.ananNew.id}/claim`, { headers, data: { version: 0 } }),
      await page.request.patch(`${apiUrl}/api/staff/tickets/${tickets.ananNew.id}/it-priority`, { headers, data: { itPriority: "LOW", version: 0 } }),
      await page.request.post(`${apiUrl}/api/staff/tickets/${tickets.ananNew.id}/internal-notes`, { headers, data: { content: "Administrator note attempt." } }),
    ]) {
      expect(response.status()).toBe(403);
    }
  });
});
