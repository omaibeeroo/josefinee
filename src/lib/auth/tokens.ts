import "server-only";
import { createHash, randomBytes } from "crypto";

/** Opaque, high-entropy session/CSRF token (never stored in plaintext). */
export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
