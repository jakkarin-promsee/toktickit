import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3100";
export const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5174";
export const seedPassword = process.env.LAB3_SEED_INITIAL_PASSWORD!;

export const accounts = {
  anan: { email: "anan@example.test", name: "Anan Chai" },
  mali: { email: "mali@example.test", name: "Mali Srisuk" },
  pim: { email: "pim@example.test", name: "Pimchanok Dee" },
  inactive: { email: "somchai.inactive@example.test", name: "Somchai Kittipong" },
  narin: { email: "narin.staff@example.test", name: "Narin Support" },
  kanda: { email: "kanda.staff@example.test", name: "Kanda Service" },
  araya: { email: "araya.admin@example.test", name: "Araya Admin" },
} as const;

export const tickets = {
  ananNew: { id: "31000000-0000-4000-8000-000000000001", number: "TKT-20261004-310001", summary: "Cannot access the shared mailbox" },
  maliOpen: { id: "31000000-0000-4000-8000-000000000002", number: "TKT-20261004-310002", summary: "Wi-Fi disconnects during online classes" },
  pimWaiting: { id: "31000000-0000-4000-8000-000000000004", number: "TKT-20261004-310004", summary: "Course page remains on the loading screen" },
} as const;

/** A unique suffix so every run creates its own records and never depends on leftovers. */
export function unique(label: string): string {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export async function signIn(page: Page, email: string, password = seedPassword) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Signs in and waits for the authenticated shell, so later navigation always carries the session cookie. The header banner is visible at every width, unlike the collapsible mobile navigation. */
export async function signInReady(page: Page, email: string, password = seedPassword) {
  await signIn(page, email, password);
  await expect(page.getByRole("banner")).toBeVisible();
}

/** Opens the collapsed mobile menu when the Menu button is shown, so navigation and Logout become reachable. */
export async function openMenuIfCollapsed(page: Page) {
  const toggle = page.getByRole("button", { name: "Menu", exact: true });
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  }
}

/** Reads the CSRF token of the browser session so direct API calls reuse the same cookie. */
export async function csrfHeaders(page: Page) {
  const me = await page.request.get(`${apiUrl}/api/auth/me`);
  expect(me.status()).toBe(200);
  const { data } = await me.json();
  return { Origin: clientOrigin, "X-CSRF-Token": data.csrfToken as string };
}

/** A separate API-only session, used for fixtures that a spec creates for itself. */
export async function apiSession(request: APIRequestContext, email: string, password = seedPassword) {
  const login = await request.post(`${apiUrl}/api/auth/login`, { headers: { Origin: clientOrigin }, data: { email, password } });
  expect(login.status(), `API login for ${email}`).toBe(200);
  const { data } = await login.json();
  return { Origin: clientOrigin, "X-CSRF-Token": data.csrfToken as string };
}

export async function createUser(request: APIRequestContext, input: { displayName: string; email: string; role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR"; initialPassword: string; isActive?: boolean }) {
  const headers = await apiSession(request, accounts.araya.email);
  const response = await request.post(`${apiUrl}/api/admin/users`, { headers, data: { isActive: true, ...input } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).data as { id: number; email: string; version: number };
}
