import { expect, test, type Page } from "@playwright/test";
import { accounts, apiSession, apiUrl, clientOrigin, openMenuIfCollapsed, signIn, signInReady, tickets } from "./helpers";
import { expectNoOverflow, viewports } from "./layout";

// VISUAL-01: readable screenshot evidence for every major Lab 3 screen and the meaningful states.
// Run with `npm run test:visual` so it starts from a freshly seeded database; the default E2E run skips @visual.
const root = "artifacts/lab-03/screenshots";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

async function shot(page: Page, folder: string, name: string, fullPage = true) {
  await expectNoOverflow(page, `${folder}/${name}`);
  await page.screenshot({ path: `${root}/${folder}/${name}.png`, fullPage, animations: "disabled" });
}

/** Holds a request open so the loading or busy state stays on screen for the screenshot. */
async function holdRequest(page: Page, pattern: string | RegExp) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(pattern, async (route) => { await gate; await route.continue(); });
  return release;
}

test.describe("VISUAL-01 screenshot evidence @visual", () => {
  // Desktop evidence uses the ui-spec 1440×900 size; per-viewport tests resize explicitly.
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeAll(async ({ playwright }) => {
    // One readable Attachment on the Staff evidence Ticket, uploaded by its Requester through the real API.
    const context = await playwright.request.newContext();
    const headers = await apiSession(context, accounts.mali.email);
    const upload = await context.post(`${apiUrl}/api/tickets/${tickets.maliOpen.id}/attachments`, { headers, multipart: { file: { name: "classroom-wifi-signal.png", mimeType: "image/png", buffer: png } } });
    expect(upload.status()).toBe(201);
    await context.dispose();
  });

  for (const viewport of viewports) {
    test(`${viewport.name}: major screens at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const v = viewport.name;

      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await shot(page, "authentication", `${v}-login`);
      await page.screenshot({ path: `${root}/before-after/after-${v}-login.png`, fullPage: true, animations: "disabled" });

      await signInReady(page, accounts.pim.email);
      await shot(page, "requester", `${v}-my-tickets`);
      await page.goto(`/tickets/${tickets.pimWaiting.id}`);
      await expect(page.getByRole("heading", { name: tickets.pimWaiting.summary })).toBeVisible();
      await shot(page, "requester", `${v}-ticket-detail`);
      await page.screenshot({ path: `${root}/before-after/after-${v}-requester-detail.png`, fullPage: true, animations: "disabled" });
      if (v === "mobile") {
        await openMenuIfCollapsed(page);
        await shot(page, "authentication", `${v}-shell-menu-open`, false);
      }
      await openMenuIfCollapsed(page);
      await page.getByRole("button", { name: "Logout" }).click();

      await signInReady(page, accounts.narin.email);
      await expect(page.getByText(/^Showing /)).toBeVisible();
      await shot(page, "staff-queue", `${v}-queue`);
      await page.screenshot({ path: `${root}/before-after/after-${v}-staff-queue.png`, fullPage: true, animations: "disabled" });
      await page.goto(`/staff/tickets/${tickets.maliOpen.id}`);
      await expect(page.getByRole("heading", { name: tickets.maliOpen.number })).toBeVisible();
      await shot(page, "staff-ticket-detail", `${v}-detail-public-comments`);
      await page.screenshot({ path: `${root}/before-after/after-${v}-staff-detail.png`, fullPage: true, animations: "disabled" });
      await page.getByRole("tab", { name: "Internal Notes" }).click();
      await shot(page, "staff-ticket-detail", `${v}-detail-internal-notes`);
      await page.getByRole("tab", { name: "Attachments" }).click();
      await expect(page.getByRole("link", { name: "classroom-wifi-signal.png" })).toBeVisible();
      await shot(page, "staff-ticket-detail", `${v}-detail-attachments`);
      await openMenuIfCollapsed(page);
      await page.getByRole("button", { name: "Logout" }).click();

      await signInReady(page, accounts.araya.email);
      await expect(page.getByText(accounts.narin.email).locator("visible=true").first()).toBeVisible();
      await shot(page, "user-management", `${v}-user-list`);
      await page.screenshot({ path: `${root}/before-after/after-${v}-user-management.png`, fullPage: true, animations: "disabled" });
      await page.getByRole("button", { name: "Create user" }).first().click();
      await expect(page.getByLabel("Display name")).toBeFocused();
      await shot(page, "user-management", `${v}-create-panel`);
      await page.locator("form.user-panel").getByRole("button", { name: "Cancel" }).click();
      await page.goto("/staff/tickets");
      await expect(page.getByRole("heading", { name: "Ticket Review" })).toBeVisible();
      await expect(page.getByText(/^Showing /)).toBeVisible();
      await shot(page, "staff-queue", `${v}-admin-ticket-review`);
    });
  }

  test("authentication states", async ({ page, request }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await shot(page, "authentication", "desktop-login-validation");

    await signIn(page, accounts.anan.email, "Wrong!Passw0rd-visual");
    await expect(page.getByRole("alert")).toHaveText("Sign-in failed. Check your credentials or account status.");
    await shot(page, "authentication", "desktop-login-failure");

    const release = await holdRequest(page, "**/api/auth/login");
    await page.getByLabel("Password", { exact: true }).fill("Any!Passw0rd-visual");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    await shot(page, "authentication", "desktop-login-busy");
    release();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.unroute("**/api/auth/login");

    // Mocked 429 so the rate-limit message is captured without locking a real account.
    await page.route("**/api/auth/login", (route) => route.request().method() === "OPTIONS" ? route.continue() : route.fulfill({ status: 429, headers: { "Retry-After": "15", "Access-Control-Allow-Origin": clientOrigin, "Access-Control-Allow-Credentials": "true", "Access-Control-Expose-Headers": "Retry-After" }, json: { error: { code: "TOO_MANY_ATTEMPTS", message: "Too many sign-in attempts. Try again later." } } }));
    await page.getByLabel("Password", { exact: true }).fill("Any!Passw0rd-visual");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Too many sign-in attempts/)).toBeVisible();
    await shot(page, "authentication", "desktop-login-rate-limited");
    await page.unroute("**/api/auth/login");

    const initial = "Visual!Initial-1";
    const headers = await apiSession(request, accounts.araya.email);
    const created = await request.post(`${apiUrl}/api/admin/users`, { headers, data: { displayName: "Kittisak First Login", email: "kittisak.first@example.test", role: "REQUESTER", isActive: true, initialPassword: initial } });
    expect(created.status()).toBe(201);
    await signIn(page, "kittisak.first@example.test", initial);
    await expect(page.getByRole("heading", { name: "Change your initial password before continuing" })).toBeVisible();
    for (const v of viewports) {
      await page.setViewportSize({ width: v.width, height: v.height });
      await shot(page, "authentication", `${v.name}-change-password`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByLabel("Current password").fill(initial);
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Confirm new password").fill("different");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
    await shot(page, "authentication", "desktop-change-password-validation");
    await page.getByLabel("New password", { exact: true }).fill("Visual!Changed-2");
    await page.getByLabel("Confirm new password").fill("Visual!Changed-2");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await shot(page, "authentication", "desktop-change-password-success");

    for (const [account, name] of [[accounts.narin, "staff"], [accounts.araya, "administrator"]] as const) {
      await page.getByRole("button", { name: "Logout" }).click();
      await signInReady(page, account.email);
      await shot(page, "authentication", `desktop-shell-${name}`, false);
    }
    await page.goto("/tickets");
    await expect(page.getByText("Access restricted")).toBeVisible();
    await shot(page, "authentication", "desktop-access-restricted");
    await page.getByRole("button", { name: "Logout" }).click();
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await shot(page, "authentication", "desktop-after-logout-direct-url");
  });

  test("Requester states", async ({ page }) => {
    await signInReady(page, accounts.pim.email);
    await page.goto("/tickets/new");
    await page.getByRole("button", { name: "Submit ticket" }).click();
    await expect(page.getByText("Select a category.")).toBeVisible();
    await shot(page, "requester", "desktop-create-ticket-validation");
    await page.goto(`/tickets/${tickets.pimWaiting.id}`);
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("Comment is required.")).toBeVisible();
    await shot(page, "requester", "desktop-comment-validation");
    await page.getByRole("button", { name: "Problem appears resolved" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, "requester", "desktop-problem-appears-resolved-dialog", false);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await page.goto(`/tickets/${tickets.maliOpen.id}`);
    await expect(page.getByText("We couldn't find this ticket.")).toBeVisible();
    await shot(page, "requester", "desktop-other-owner-not-found");
  });

  test("Staff Queue states", async ({ page }) => {
    await signInReady(page, accounts.narin.email);
    await expect(page.getByText(/^Showing /)).toBeVisible();
    await page.getByLabel("Owner").selectOption("unassigned");
    await page.getByLabel("Sort by").selectOption("ticketNumber");
    await expect(page).toHaveURL(/owner=unassigned/);
    await expect(page.getByText(/^Showing /)).toBeVisible();
    await shot(page, "staff-queue", "desktop-filtered-unassigned");
    await page.getByLabel("Search tickets").fill("printer in room 999");
    await expect(page.getByText("No tickets match")).toBeVisible();
    await shot(page, "staff-queue", "desktop-no-results");

    const release = await holdRequest(page, "**/api/staff/tickets?*");
    await page.goto("/staff/tickets?pageSize=10");
    await expect(page.getByText("Loading tickets…")).toBeVisible();
    await shot(page, "staff-queue", "desktop-loading");
    release();
    await expect(page.getByText(/^Showing /)).toBeVisible();
    await page.unroute("**/api/staff/tickets?*");

    // Mocked HTTP responses for states that the seeded database cannot produce on demand.
    const cors = { "Access-Control-Allow-Origin": clientOrigin, "Access-Control-Allow-Credentials": "true" };
    await page.route("**/api/staff/tickets*", (route) => route.fulfill({ status: 200, headers: cors, json: { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false }, counts: { total: 0, unassigned: 0, mine: 0 } } }));
    await page.goto("/staff/tickets");
    await expect(page.getByText(/No tickets exist yet/)).toBeVisible();
    await shot(page, "staff-queue", "desktop-empty-mocked");
    await page.unroute("**/api/staff/tickets*");
    await page.route("**/api/staff/tickets*", (route) => route.fulfill({ status: 503, headers: cors, json: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Tickets are temporarily unavailable." } } }));
    await page.goto("/staff/tickets?status=OPEN");
    await expect(page.getByText(/Tickets could not be loaded/)).toBeVisible();
    await shot(page, "staff-queue", "desktop-failure-mocked");
    await page.unroute("**/api/staff/tickets*");
    await page.route("**/api/staff/tickets*", (route) => route.fulfill({ status: 403, headers: cors, json: { error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } } }));
    await page.goto("/staff/tickets");
    await expect(page.getByText(/Forbidden\. Your account is not permitted/)).toBeVisible();
    await shot(page, "staff-queue", "desktop-forbidden-mocked");
    await page.unroute("**/api/staff/tickets*");
  });

  test("Staff Ticket Detail states", async ({ page, request }) => {
    const headers = await apiSession(request, accounts.anan.email);
    const created = await request.post(`${apiUrl}/api/tickets`, { headers, data: { categoryId: 2, relatedSystemId: 6, summary: "Projector in Room 501 shows no signal", requestedPriority: "HIGH", description: "The projector powers on but shows a no-signal message from the classroom PC." } });
    const ticket = (await created.json()).data as { id: string; ticketNumber: string };

    await signInReady(page, accounts.narin.email);
    await page.goto(`/staff/tickets/${ticket.id}`);
    await expect(page.getByRole("heading", { name: ticket.ticketNumber })).toBeVisible();
    await shot(page, "staff-ticket-detail", "desktop-unassigned-new");
    await page.getByRole("button", { name: "Claim ticket" }).click();
    await expect(page.getByText("You now own this Ticket.")).toBeVisible();
    await shot(page, "staff-ticket-detail", "desktop-claim-success");
    await page.getByRole("button", { name: "Move to Cancelled" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, "staff-ticket-detail", "desktop-confirmation-dialog", false);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Post public comment" }).click();
    await expect(page.getByText("Comment is required.")).toBeVisible();
    await shot(page, "staff-ticket-detail", "desktop-comment-validation");

    const other = await apiSession(request, accounts.kanda.email);
    const detail = await (await request.get(`${apiUrl}/api/staff/tickets/${ticket.id}`, { headers: other })).json();
    await request.patch(`${apiUrl}/api/staff/tickets/${ticket.id}/it-priority`, { headers: other, data: { itPriority: "MEDIUM", version: detail.data.version } });
    await page.getByLabel("IT Priority").selectOption("LOW");
    await page.getByRole("button", { name: "Save IT Priority" }).click();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
    await shot(page, "staff-ticket-detail", "desktop-stale-conflict");

    await page.getByRole("button", { name: "Logout" }).click();
    await signInReady(page, accounts.araya.email);
    await page.goto(`/staff/tickets/${tickets.maliOpen.id}`);
    await expect(page.getByText("Read-only administrator view")).toBeVisible();
    await shot(page, "staff-ticket-detail", "desktop-administrator-read-only");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot(page, "staff-ticket-detail", "mobile-administrator-read-only");
  });

  test("User Management states", async ({ page }) => {
    await signInReady(page, accounts.araya.email);
    await page.getByRole("button", { name: "Create user" }).first().click();
    await page.locator("form.user-panel").getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText("Display name must contain 2–100 characters.")).toBeVisible();
    await shot(page, "user-management", "desktop-create-validation");

    await page.getByLabel("Display name").fill("Suda Wattana");
    await page.getByLabel("Email", { exact: true }).fill(accounts.anan.email);
    await page.locator("#user-role").selectOption("IT_STAFF");
    await page.locator("#user-password").fill("Visual!Create-1x");
    await page.locator("#user-confirm").fill("Visual!Create-1x");
    await page.locator("form.user-panel").getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText("A user with this email already exists.")).toBeVisible();
    await shot(page, "user-management", "desktop-duplicate-email");
    await page.getByLabel("Email", { exact: true }).fill("suda.wattana@example.test");
    await page.locator("form.user-panel").getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText("User Suda Wattana created.")).toBeVisible();
    await shot(page, "user-management", "desktop-create-success");

    await page.getByRole("table").getByRole("button", { name: `Edit ${accounts.araya.name}` }).click();
    await expect(page.getByText(/cannot change your own role/)).toBeVisible();
    await shot(page, "user-management", "desktop-self-protection");
    await page.locator("form.user-panel").getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("table").getByRole("button", { name: `Edit ${accounts.narin.name}` }).click();
    await page.getByLabel("Active").uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog", { name: "Confirm role or status change" })).toBeVisible();
    await shot(page, "user-management", "desktop-confirm-deactivation", false);
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/Reassign owned Tickets before deactivating/)).toBeVisible();
    await shot(page, "user-management", "desktop-owner-conflict");
    await page.getByRole("button", { name: "Set new initial password" }).click();
    await expect(page.getByRole("dialog", { name: /Set new initial password/ })).toBeVisible();
    await shot(page, "user-management", "desktop-reset-password-dialog", false);
    await page.keyboard.press("Escape");
    await page.locator("form.user-panel").getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog", { name: "Discard changes?" }).getByRole("button", { name: "Discard" }).click();

    await page.getByLabel("Search users").fill("nobody-by-this-name");
    await expect(page.getByText("No users match")).toBeVisible();
    await shot(page, "user-management", "desktop-no-results");

    const cors = { "Access-Control-Allow-Origin": clientOrigin, "Access-Control-Allow-Credentials": "true" };
    await page.route("**/api/admin/users*", (route) => route.fulfill({ status: 503, headers: cors, json: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Users are temporarily unavailable." } } }));
    await page.reload();
    await expect(page.getByText(/Users could not be loaded/)).toBeVisible();
    await shot(page, "user-management", "desktop-failure-mocked");
    await page.unroute("**/api/admin/users*");

    await page.getByRole("button", { name: "Logout" }).click();
    await signInReady(page, accounts.narin.email);
    await page.goto("/admin/users");
    await expect(page.getByText("Access restricted")).toBeVisible();
    await shot(page, "user-management", "desktop-non-administrator-forbidden");
  });

  // Runs last because it changes seeded data (reassignment, resolution signal, extra Tickets).
  test("submission states that change data", async ({ page, request }) => {
    // Part 5: an inactive account gets the same safe failure as a wrong password.
    await signIn(page, accounts.inactive.email);
    await expect(page.getByRole("alert")).toHaveText("Sign-in failed. Check your credentials or account status.");
    await shot(page, "authentication", "desktop-login-inactive");

    // Part 8: optional single role filter.
    await signInReady(page, accounts.araya.email);
    await page.locator("#user-role-filter").selectOption("IT_STAFF");
    await expect(page.getByRole("table").getByText(accounts.anan.email)).toHaveCount(0);
    await expect(page.getByRole("table").getByText(accounts.narin.email)).toBeVisible();
    await shot(page, "user-management", "desktop-role-filter");
    await page.getByRole("button", { name: "Logout" }).click();

    // Part 7: the Requester confirms Problem Appears Resolved; status stays Waiting for Requester.
    await signInReady(page, accounts.pim.email);
    await page.goto(`/tickets/${tickets.pimWaiting.id}`);
    await page.getByRole("button", { name: "Problem appears resolved" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(/You indicated the problem appears resolved/)).toBeVisible();
    await shot(page, "requester", "desktop-problem-appears-resolved-confirmed");
    await page.getByRole("button", { name: "Logout" }).click();

    // Part 7: IT Staff sees the Requester indication, then reassigns with confirmation.
    await signInReady(page, accounts.narin.email);
    await page.goto(`/staff/tickets/${tickets.pimWaiting.id}`);
    await expect(page.getByText("Requester indication")).toBeVisible();
    await shot(page, "staff-ticket-detail", "desktop-requester-indication");
    await page.goto(`/staff/tickets/${tickets.maliOpen.id}`);
    await page.getByLabel("Reassign to").selectOption({ label: accounts.kanda.name });
    await page.getByRole("button", { name: "Reassign" }).click();
    await expect(page.getByRole("dialog")).toContainText(`from ${accounts.narin.name} to ${accounts.kanda.name}`);
    await shot(page, "staff-ticket-detail", "desktop-reassign-dialog", false);
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(`Ticket assigned to ${accounts.kanda.name}.`)).toBeVisible();
    await shot(page, "staff-ticket-detail", "desktop-reassign-success");

    // Part 6: enough Tickets for more than one Queue page.
    const headers = await apiSession(request, accounts.anan.email);
    const rooms = ["101", "102", "103", "201", "202", "203", "301", "302", "303", "401", "402", "403"];
    for (const room of rooms) {
      const created = await request.post(`${apiUrl}/api/tickets`, { headers, data: { categoryId: 2, relatedSystemId: 6, summary: `Printer in Room ${room} jams on duplex jobs`, requestedPriority: room.endsWith("1") ? "HIGH" : "MEDIUM", description: `The shared printer in Room ${room} jams whenever a double-sided job is sent.` } });
      expect(created.status()).toBe(201);
    }
    await page.goto("/staff/tickets?pageSize=10");
    await expect(page.getByText(/^Page 1 of [2-9]$/)).toBeVisible();
    await shot(page, "staff-queue", "desktop-pagination-page-1");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/^Page 2 of [2-9]$/)).toBeVisible();
    await shot(page, "staff-queue", "desktop-pagination-page-2");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/staff/tickets?pageSize=10");
    await expect(page.getByText(/^Page 1 of [2-9]$/)).toBeVisible();
    await shot(page, "staff-queue", "mobile-pagination");
  });
});
