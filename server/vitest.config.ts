import { defineConfig } from "vitest/config";
import path from "node:path";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ??
  "postgresql://toktickit:toktickit@localhost:5432/toktickit?schema=lab2_test";
process.env.ATTACHMENT_STORAGE = process.env.TEST_ATTACHMENT_STORAGE ??
  path.resolve(".tmp/test-attachments");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
  },
});
