import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

export function setup() {
  const storage = process.env.ATTACHMENT_STORAGE;
  if (storage) rmSync(storage, { recursive: true, force: true });

  execSync("npx prisma db push --force-reset --skip-generate", {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  execSync("npx prisma db seed", {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

export function teardown() {
  const storage = process.env.ATTACHMENT_STORAGE;
  if (storage) rmSync(storage, { recursive: true, force: true });
}
