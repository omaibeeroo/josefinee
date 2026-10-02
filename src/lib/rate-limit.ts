import "server-only";
import { AppError } from "@/lib/errors";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type RateLimitOptions = {
  /** Unique bucket key, e.g. `login:1.2.3.4` or `checkout:<cartId>`. */
  key: string;
  limit: number;
  windowMs: number;
};

type MemoryBucket = { count: number; resetAt: number };

const globalStore = globalThis as unknown as { __rateLimit?: Map<string, MemoryBucket> };
const memory: Map<string, MemoryBucket> = (globalStore.__rateLimit ??= new Map());

function memoryLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = memory.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    memory.set(key, { count: 1, resetAt });
    return { success: true, limit, remaining: limit - 1, resetAt };
  }

  bucket.count += 1;
  const success = bucket.count <= limit;
  return { success, limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

async function upstashLimit(options: RateLimitOptions): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const redisKey = `ratelimit:${options.key}`;
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, String(options.windowMs), "NX"],
        ["PTTL", redisKey],
      ]),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as Array<{ result: number | string }>;
    const count = Number(payload[0]?.result ?? 1);
    const ttl = Number(payload[2]?.result ?? options.windowMs);
    const resetAt = Date.now() + (ttl > 0 ? ttl : options.windowMs);

    return {
      success: count <= options.limit,
      limit: options.limit,
      remaining: Math.max(0, options.limit - count),
      resetAt,
    };
  } catch {
    return null;
  }
}

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const distributed = await upstashLimit(options);
  return distributed ?? memoryLimit(options);
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  const result = await rateLimit(options);
  if (!result.success) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many attempts. Please wait a moment and try again.",
      429,
    );
  }
}

/** Common limit presets (per key). Tune per endpoint as needed. */
export const LIMITS = {
  login: { limit: 8, windowMs: 15 * 60_000 },
  adminLogin: { limit: 5, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  checkout: { limit: 10, windowMs: 10 * 60_000 },
  coupon: { limit: 12, windowMs: 10 * 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  newsletter: { limit: 5, windowMs: 60 * 60_000 },
  contact: { limit: 5, windowMs: 60 * 60_000 },
  upload: { limit: 40, windowMs: 10 * 60_000 },
  api: { limit: 120, windowMs: 60_000 },
} as const;

export async function clientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded ? (forwarded.split(",")[0]?.trim() ?? "unknown") : "unknown";
}
