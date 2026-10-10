import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { AppError } from "@/lib/errors";

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60_000;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new AppError("CONFIG", "Server misconfiguration.", 500);
  return value;
}

/** Signed, expiring token so order pages are not guessable by order number. */
export function signOrderToken(orderNumber: string, ttlMs = DEFAULT_TTL_MS): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${orderNumber}.${expiresAt}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${expiresAt}.${signature}`;
}

export function verifyOrderToken(orderNumber: string, token: string | undefined): boolean {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  if (!expiresRaw || !signature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = createHmac("sha256", secret())
    .update(`${orderNumber}.${expiresAt}`)
    .digest("base64url");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
