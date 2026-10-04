import { expect, test } from "@playwright/test";
import { accounts, apiUrl, createUser, csrfHeaders, signIn, signInReady, unique } from "./helpers";

const failureCopy = "Sign-in failed. Check your credentials or account status.";

test.describe("E2E-01 authentication lifecycle", () => {
  test("valid login shows the authenticated identity and role, then logout blocks direct access", async ({ page }) => {
    await signIn(page, accounts.anan.email);
    const header = page.locator("header");
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(header.getByText(accounts.anan.name)).toBeVisible();
    await expect(header.getByText("REQUESTER")).toBeVisible();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

    await page.reload();
    await expect(header.getByText(accounts.anan.name)).toBeVisible();

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText(accounts.anan.name)).toHaveCount(0);
    const direct = await page.request.get(`${apiUrl}/api/tickets`);
    expect(direct.status()).toBe(401);
    expect(await direct.text()).not.toContain("TKT-");
  });

  test("invalid and inactive logins show the same safe failure and create no session", async ({ page }) => {
    await signIn(page, accounts.anan.email, "Wrong!Passw0rd-e2e");
    await expect(page.getByRole("alert")).toHaveText(failureCopy);
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");

    await page.getByLabel("Email").fill(accounts.inactive.email);
    await page.getByLabel("Password", { exact: true }).fill(process.env.LAB3_SEED_INITIAL_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText(failureCopy);
    await expect(page.getByText(/inactive|deactivated/i)).toHaveCount(0);

    expect((await page.request.get(`${apiUrl}/api/auth/me`)).status()).toBe(401);
  });

  test("local validation runs before any request", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email is required.")).toBeVisible();
    await expect(page.getByText("Password is required.")).toBeVisible();
  });

  test("a first-login user cannot enter the application until a valid new password is saved", async ({ page, request }) => {
    const initial = "First!Login-e2e-1";
    const changed = "Changed!Login-e2e-2";
    const user = await createUser(request, { displayName: "E2E First Login", email: `${unique("e2e-first")}@example.test`, role: "REQUESTER", initialPassword: initial });

    await signIn(page, user.email, initial);
    await expect(page.getByRole("heading", { name: "Change your initial password before continuing" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);

    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "Change your initial password before continuing" })).toBeVisible();
    const blocked = await page.request.get(`${apiUrl}/api/tickets`);
    expect(blocked.status()).toBe(403);
    expect((await blocked.json()).error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    await page.getByLabel("Current password").fill(initial);
    await page.getByLabel("New password", { exact: true }).fill("short1!A");
    await page.getByLabel("Confirm new password").fill("short1!A");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password must contain 12–128 characters.")).toBeVisible();

    await page.getByLabel("New password", { exact: true }).fill(changed);
    await page.getByLabel("Confirm new password").fill(changed);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    expect((await page.request.get(`${apiUrl}/api/tickets`)).status()).toBe(200);

    await page.getByRole("button", { name: "Logout" }).click();
    await signIn(page, user.email, initial);
    await expect(page.getByRole("alert")).toHaveText(failureCopy);
    await page.getByLabel("Password", { exact: true }).fill(changed);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Change your initial password before continuing" })).toHaveCount(0);
  });

  test("each role sees only its own destinations and direct URLs are blocked", async ({ page }) => {
    await signInReady(page, accounts.narin.email);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await expect(nav.getByText("User Management")).toHaveCount(0);
    await page.goto("/admin/users");
    await expect(page.getByText("Access restricted")).toBeVisible();
    expect((await page.request.get(`${apiUrl}/api/admin/users`)).status()).toBe(403);

    await page.getByRole("button", { name: "Logout" }).click();
    await signInReady(page, accounts.araya.email);
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(nav.getByText("Ticket Queue")).toHaveCount(0);

    await page.getByRole("button", { name: "Logout" }).click();
    await signInReady(page, accounts.anan.email);
    await page.goto("/staff/tickets");
    await expect(page.getByText("Access restricted")).toBeVisible();
    const headers = await csrfHeaders(page);
    const forbidden = await page.request.post(`${apiUrl}/api/staff/tickets/00000000-0000-4000-8000-000000000000/claim`, { headers, data: { version: 0 } });
    expect(forbidden.status()).toBe(403);
  });
});
