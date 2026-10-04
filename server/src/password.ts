import argon2 from "argon2";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required.";
  const length = Array.from(password).length;
  if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
    return `Password must contain ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a digit.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain a symbol.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const error = passwordPolicyError(password);
  if (error) throw new Error(error);
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
  });
}
