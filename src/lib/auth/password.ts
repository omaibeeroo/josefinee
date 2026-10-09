import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { AppError } from "@/lib/errors";

const ARGON_OPTIONS = {
  // @node-rs/argon2 defaults to Argon2id — the OWASP-recommended variant.
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/** Defense-in-depth cap so oversized input never reaches Argon2 (CPU DoS). */
const MAX_PASSWORD_LENGTH = 200;

export async function hashPassword(password: string): Promise<string> {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new AppError("VALIDATION", "Password is too long.", 400);
  }
  return hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  try {
    return await verify(passwordHash, password, ARGON_OPTIONS);
  } catch {
    return false;
  }
}

export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 10) issues.push("Must be at least 10 characters long.");
  if (!/[a-z]/.test(password)) issues.push("Must contain a lowercase letter.");
  if (!/[A-Z]/.test(password)) issues.push("Must contain an uppercase letter.");
  if (!/\d/.test(password)) issues.push("Must contain a number.");
  return issues;
}

export function isStrongPassword(password: string): boolean {
  return passwordIssues(password).length === 0;
}
