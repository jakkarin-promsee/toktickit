import { afterEach, describe, expect, it } from "vitest";
import { isAllowedOrigin, normalizeEmail, parseCookie, randomSecret, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sha256 } from "../../src/auth.js";

const originalOrigin = process.env.CLIENT_ORIGIN;

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.CLIENT_ORIGIN;
  else process.env.CLIENT_ORIGIN = originalOrigin;
});

describe("UNIT-02 session helpers", () => {
  it("creates opaque 256-bit hex secrets that do not repeat", () => {
    const secrets = new Set(Array.from({ length: 50 }, () => randomSecret()));
    expect(secrets.size).toBe(50);
    for (const secret of secrets) expect(secret).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stores only a deterministic SHA-256 hash that differs from the raw token", () => {
    const token = randomSecret();
    expect(sha256(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256(token)).toBe(sha256(token));
    expect(sha256(token)).not.toBe(token);
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("uses a fixed eight-hour session lifetime and a stable cookie name", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
    expect(SESSION_COOKIE).toBe("toktickit_session");
  });

  it("reads only the named cookie and handles missing or encoded values", () => {
    expect(parseCookie(undefined, SESSION_COOKIE)).toBeNull();
    expect(parseCookie("other=1", SESSION_COOKIE)).toBeNull();
    expect(parseCookie(`a=1; ${SESSION_COOKIE}=abc%3D; b=2`, SESSION_COOKIE)).toBe("abc=");
    expect(parseCookie(`x${SESSION_COOKIE}=nope`, SESSION_COOKIE)).toBeNull();
  });

  it("accepts only the configured client Origin", () => {
    delete process.env.CLIENT_ORIGIN;
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin(undefined)).toBe(false);
    expect(isAllowedOrigin("http://localhost:5174")).toBe(false);
    process.env.CLIENT_ORIGIN = "https://toktickit.test";
    expect(isAllowedOrigin("https://toktickit.test")).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173")).toBe(false);
  });

  it("normalizes email case and surrounding whitespace only", () => {
    expect(normalizeEmail("  Mixed.Case@Example.TEST\t")).toBe("mixed.case@example.test");
    expect(normalizeEmail("a+b@example.test")).toBe("a+b@example.test");
  });
});
