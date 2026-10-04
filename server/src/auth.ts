import crypto from "node:crypto";

export const SESSION_COOKIE = "toktickit_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  const configured = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  return origin === configured;
}
