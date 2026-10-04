import { expect, test, type APIRequestContext } from "@playwright/test";
import { accounts, apiSession, apiUrl, clientOrigin, createUser, csrfHeaders, signIn, signInReady, unique } from "./helpers";

const initialPassword = "Admin!Created-e2e-1";

async function userByEmail(request: APIRequestContext, headers: Record<string, string>, email: string) {
  const response = await request.get(`${apiUrl}/api/admin/users`, { headers, params: { search: email } });
  expect(response.status()).toBe(200);
  return ((await response.json()).data as { id: number; email: string; displayName: string; role: string; isActive: boolean; version: number }[]).find((user) => user.email === email)!;
}

test.describe("E2E-04 Administrator User Management", () => {
  test("lists users with name, email, role, status, and Edit, and searches and filters them", async ({ page }) => {
    await signInReady(page, accounts.araya.email);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    const table = page.getByRole("table");
    for (const header of ["Name", "Email", "Role", "Status", "Edit"]) await expect(table.getByRole("columnheader", { name: header })).toBeVisible();
    await expect(table.getByText(accounts.anan.email)).toBeVisible();
    await expect(table.getByText("Inactive").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);

    await page.getByLabel("Search users").fill("narin");
    await expect(table.getByText(accounts.narin.email)).toBeVisible();
    await expect(table.getByText(accounts.anan.email)).toHaveCount(0);

    await page.getByRole("button", { name: "Clear" }).click();
    await page.locator("#user-role-filter").selectOption("ADMINISTRATOR");
    await expect(table.getByText(accounts.araya.email)).toBeVisible();
    await expect(table.getByText(accounts.narin.email)).toHaveCount(0);
  });

  test("creates a one-role user, rejects a duplicate email, edits, deactivates, and reactivates the account", async ({ page, request }) => {
    const email = `${unique("e2e-admin-create")}@example.test`;
    const name = `E2E Staff ${Date.now()}`;
    await signInReady(page, accounts.araya.email);
    await expect(page.getByRole("table")).toBeVisible();

    await page.getByRole("button", { name: "Create user" }).click();
    const form = page.locator("form").filter({ has: page.locator("#user-name") });
    await form.locator("#user-name").fill(name);
    await form.locator("#user-email").fill(accounts.anan.email);
    await form.locator("#user-role").selectOption("IT_STAFF");
    await form.locator("#user-password").fill(initialPassword);
    await form.locator("#user-confirm").fill(initialPassword);
    await form.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText("A user with this email already exists.")).toBeVisible();
    await expect(form.locator("#user-name")).toHaveValue(name);

    await form.locator("#user-email").fill(email);
    await form.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText(`User ${name} created.`)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(initialPassword);
    const created = await userByEmail(page.request, {}, email);
    expect(created).toMatchObject({ role: "IT_STAFF", isActive: true });

    const renamed = `${name} Renamed`;
    await page.getByRole("table").getByRole("button", { name: `Edit ${name}` }).click();
    await form.locator("#user-name").fill(renamed);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`User ${renamed} updated.`)).toBeVisible();

    await page.getByRole("table").getByRole("button", { name: `Edit ${renamed}` }).click();
    await form.getByLabel("Active").uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("dialog", { name: "Confirm role or status change" }).getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(`User ${renamed} updated.`)).toBeVisible();
    expect((await userByEmail(page.request, {}, email)).isActive).toBe(false);
    const inactiveLogin = await request.post(`${apiUrl}/api/auth/login`, { headers: { Origin: clientOrigin }, data: { email, password: initialPassword } });
    expect(inactiveLogin.status()).toBe(401);

    await page.getByRole("table").getByRole("button", { name: `Edit ${renamed}` }).click();
    await form.getByLabel("Active").check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("dialog", { name: "Confirm role or status change" }).getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText(`User ${renamed} updated.`)).toBeVisible();
    expect((await userByEmail(page.request, {}, email)).isActive).toBe(true);
  });

  test("sets a new initial password that the user must change at the next login", async ({ page, browser, request }) => {
    const name = `E2E Reset ${Date.now()}`;
    const email = `${unique("e2e-admin-reset")}@example.test`;
    await createUser(request, { displayName: name, email, role: "REQUESTER", initialPassword });
    const resetPassword = "Reset!Initial-e2e-2";

    await signInReady(page, accounts.araya.email);
    await page.getByLabel("Search users").fill(email);
    await page.getByRole("table").getByRole("button", { name: `Edit ${name}` }).click();
    await page.getByRole("button", { name: "Set new initial password" }).click();
    const dialog = page.getByRole("dialog", { name: new RegExp(`Set new initial password for ${name}`) });
    await expect(dialog.getByText(/All current sessions for this user will end/)).toBeVisible();
    await dialog.getByLabel("New initial password", { exact: true }).fill(resetPassword);
    await dialog.getByLabel("Confirm new initial password").fill(resetPassword);
    await dialog.getByRole("button", { name: "Set password" }).click();
    await expect(page.getByText(new RegExp(`New initial password set for ${name}`))).toBeVisible();
    await expect(page.locator("body")).not.toContainText(resetPassword);

    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await signIn(userPage, email, resetPassword);
    await expect(userPage.getByRole("heading", { name: "Change your initial password before continuing" })).toBeVisible();
    await userPage.getByLabel("Current password").fill(resetPassword);
    await userPage.getByLabel("New password", { exact: true }).fill("Chosen!Password-e2e-3");
    await userPage.getByLabel("Confirm new password").fill("Chosen!Password-e2e-3");
    await userPage.getByRole("button", { name: "Change password" }).click();
    await expect(userPage.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await userContext.close();
  });

  test("prevents self-deactivation and own-role change in the UI and through the direct API", async ({ page }) => {
    await signInReady(page, accounts.araya.email);
    await page.getByLabel("Search users").fill(accounts.araya.email);
    await page.getByRole("table").getByRole("button", { name: `Edit ${accounts.araya.name}` }).click();
    await expect(page.locator("#user-role")).toBeDisabled();
    await expect(page.getByLabel("Active")).toBeDisabled();
    await expect(page.getByText(/cannot change your own role/)).toBeVisible();

    const headers = await csrfHeaders(page);
    const self = await userByEmail(page.request, headers, accounts.araya.email);
    const attempt = await page.request.patch(`${apiUrl}/api/admin/users/${self.id}`, { headers, data: { displayName: self.displayName, email: self.email, role: "ADMINISTRATOR", isActive: false, version: self.version } });
    expect(attempt.status()).toBe(409);
    expect((await attempt.json()).error.code).toBe("SELF_ADMIN_CHANGE_FORBIDDEN");
    expect((await userByEmail(page.request, headers, accounts.araya.email)).isActive).toBe(true);
  });

  test("never lets two Administrators deactivate each other into having no active Administrator", async ({ playwright }) => {
    const firstContext = await playwright.request.newContext();
    const secondContext = await playwright.request.newContext();
    const email = `${unique("e2e-second-admin")}@example.test`;
    const second = await createUser(firstContext, { displayName: "E2E Second Admin", email, role: "ADMINISTRATOR", initialPassword });

    // The new Administrator completes the forced password change first.
    const secondLogin = await apiSession(secondContext, email, initialPassword);
    const changed = await secondContext.post(`${apiUrl}/api/auth/change-password`, { headers: secondLogin, data: { currentPassword: initialPassword, newPassword: "Second!Admin-e2e-2" } });
    expect(changed.status()).toBe(200);
    const secondHeaders = { Origin: clientOrigin, "X-CSRF-Token": (await changed.json()).data.csrfToken as string };
    const firstHeaders = await apiSession(firstContext, accounts.araya.email);
    const araya = await userByEmail(firstContext, firstHeaders, accounts.araya.email);
    const secondUser = await userByEmail(firstContext, firstHeaders, email);

    const [firstResult, secondResult] = await Promise.all([
      firstContext.patch(`${apiUrl}/api/admin/users/${second.id}`, { headers: firstHeaders, data: { displayName: secondUser.displayName, email, role: "ADMINISTRATOR", isActive: false, version: secondUser.version } }),
      secondContext.patch(`${apiUrl}/api/admin/users/${araya.id}`, { headers: secondHeaders, data: { displayName: araya.displayName, email: araya.email, role: "ADMINISTRATOR", isActive: false, version: araya.version } }),
    ]);
    const statuses = [firstResult.status(), secondResult.status()];
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    const loser = firstResult.status() === 200 ? secondResult : firstResult;
    // The losing request either hits the last-active-Administrator rule or finds its own session already ended.
    expect([401, 409]).toContain(loser.status());
    if (loser.status() === 409) expect((await loser.json()).error.code).toBe("LAST_ACTIVE_ADMINISTRATOR");

    // Restore the seeded Administrator so the result is the same on every rerun.
    const survivor = firstResult.status() === 200 ? { context: firstContext, headers: firstHeaders } : { context: secondContext, headers: secondHeaders };
    const admins = (await (await survivor.context.get(`${apiUrl}/api/admin/users`, { headers: survivor.headers, params: { role: "ADMINISTRATOR" } })).json()).data as { isActive: boolean }[];
    expect(admins.filter((admin) => admin.isActive)).toHaveLength(1);
    if (firstResult.status() !== 200) {
      const current = await userByEmail(secondContext, secondHeaders, accounts.araya.email);
      const restore = await secondContext.patch(`${apiUrl}/api/admin/users/${araya.id}`, { headers: secondHeaders, data: { displayName: current.displayName, email: current.email, role: "ADMINISTRATOR", isActive: true, version: current.version } });
      expect(restore.status()).toBe(200);
    }
    await firstContext.dispose();
    await secondContext.dispose();
  });

  test("blocks non-Administrators from User Management in the UI and the API", async ({ page }) => {
    for (const account of [accounts.anan, accounts.narin]) {
      await signInReady(page, account.email);
      await expect(page.getByRole("navigation", { name: "Main navigation" }).getByText("User Management")).toHaveCount(0);
      await page.goto("/admin/users");
      await expect(page.getByText("Access restricted")).toBeVisible();
      const headers = await csrfHeaders(page);
      const list = await page.request.get(`${apiUrl}/api/admin/users`);
      expect(list.status()).toBe(403);
      expect(await list.text()).not.toContain("@example.test");
      const create = await page.request.post(`${apiUrl}/api/admin/users`, { headers, data: { displayName: "Not Allowed", email: `${unique("blocked")}@example.test`, role: "ADMINISTRATOR", isActive: true, initialPassword } });
      expect(create.status()).toBe(403);
      await page.getByRole("button", { name: "Logout" }).click();
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    }
  });
});
