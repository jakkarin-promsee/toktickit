import { describe, expect, it } from "vitest";
import { hashPassword, passwordPolicyError, verifyPassword } from "../../src/password.js";
import { normalizeEmail } from "../../src/auth.js";

describe("UNIT-01 authentication validation", () => {
  it("normalizes email and enforces the documented password boundaries", async () => {
    expect(normalizeEmail("  USER@Example.Test ")).toBe("user@example.test");
    expect(passwordPolicyError("Ab1!".repeat(3))).toBeNull();
    expect(passwordPolicyError("a".repeat(129) + "A1!")).toMatch(/128/);
    expect(passwordPolicyError("NoSymbolPassword12")).toMatch(/symbol/);
  });

  it("creates a salted Argon2id hash and verifies it without returning plaintext", async () => {
    const password = "Example!Pass123";
    const hash = await hashPassword(password);
    expect(hash).toContain("$argon2id$");
    expect(hash).not.toContain(password);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, "Wrong!Pass123")).resolves.toBe(false);
  });
});
