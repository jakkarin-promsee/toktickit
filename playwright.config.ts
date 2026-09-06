import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

const clientUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5174";
const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:3100";
const installedChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
  (process.platform === "win32" && existsSync(installedChrome) ? installedChrome : undefined);
const e2eDatabaseUrl = process.env.PLAYWRIGHT_DATABASE_URL ??
  "postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=lab2_e2e";

process.env.DATABASE_URL = e2eDatabaseUrl;
process.env.ATTACHMENT_STORAGE = process.env.PLAYWRIGHT_ATTACHMENT_STORAGE ??
  path.resolve(".tmp/playwright-attachments");
process.env.PLAYWRIGHT_API_URL = apiUrl;
process.env.VITE_API_URL = apiUrl;
process.env.PORT = new URL(apiUrl).port;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: clientUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "npm --prefix server run dev",
      url: `${apiUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm --prefix client run dev -- --host 127.0.0.1 --port ${new URL(clientUrl).port}`,
      url: clientUrl,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
