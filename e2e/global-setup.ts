import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Seeded accounts start with mustChangePassword=true. The E2E workflows need them
// ready to use, so this deterministic fixture step clears the flag on the isolated
// E2E schema only. First-login behavior is tested with accounts each spec creates.
function prepareSeededAccounts() {
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "public";
  if (schema === "public") throw new Error("E2E setup refuses to modify the public schema.");
  execSync("npx prisma db execute --stdin --schema prisma/schema.prisma", {
    cwd: "server",
    env: process.env,
    input: `UPDATE "${schema}"."User" SET "mustChangePassword" = false;`,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

export default function globalSetup() {
  const storage = process.env.ATTACHMENT_STORAGE;
  if (storage) rmSync(storage, { recursive: true, force: true });

  execSync("npx prisma db push --force-reset --skip-generate", {
    cwd: "server",
    env: process.env,
    stdio: "inherit",
  });
  execSync("npx prisma db seed", {
    cwd: "server",
    env: process.env,
    stdio: "inherit",
  });
  prepareSeededAccounts();
}
