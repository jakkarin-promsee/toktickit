import { rmSync } from "node:fs";

export default function globalTeardown() {
  const storage = process.env.ATTACHMENT_STORAGE;
  if (storage) rmSync(storage, { recursive: true, force: true });
}
