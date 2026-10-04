import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { rmSync } from "node:fs";

export function setup() {
  const storage = process.env.ATTACHMENT_STORAGE;
  if (storage) rmSync(storage, { recursive: true, force: true });
  process.env.LAB3_SEED_INITIAL_PASSWORD ??= `Test-${crypto.randomBytes(18).toString("base64url")}!Aa1`;

  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
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
