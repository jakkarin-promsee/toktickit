import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

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
}
