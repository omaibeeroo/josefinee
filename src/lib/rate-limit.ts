import "server-only";
import { createHash, createHmac } from "node:crypto";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { extractClientIp } from "@/lib/request-ip";

type RateLimitResult = {
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
type DbBucket = { count: number; resetAt: Date };

const globalStore = globalThis as unknown as {
  __rateLimit?: Map<string, MemoryBucket>;
  __rateLimitCleanupCount?: number;
};
const memory: Map<string, MemoryBucket> = (globalStore.__rateLimit ??= new Map());

/** Bound for the dev/test in-memory fallback so attacker keys cannot grow the heap. */
const MEMORY_BUCKET_CAP = 5000;

function memoryLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = memory.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && memory.size >= MEMORY_BUCKET_CAP) {
      // Evict the oldest bucket (Map preserves insertion order).
      const oldest = memory.keys().next();
      if (!oldest.done) memory.delete(oldest.value);
    }
    const resetAt = now + windowMs;
    memory.set(key, { count: 1, resetAt });
    return { success: true, limit, remaining: limit - 1, resetAt };
  }
  bucket.count += 1;
  return {
    success: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

function opaqueKey(key: string): string {
  const secret = process.env.AUTH_SECRET;
  return secret
    ? createHmac("sha256", secret).update(key).digest("hex")
    : createHash("sha256").update(key).digest("hex");
}

async function upstashLimit(options: RateLimitOptions): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const redisKey = `ratelimit:${opaqueKey(options.key)}`;
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
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as Array<{ result: number | string }>;
    const rawCount = payload[0]?.result;
    if (rawCount === undefined) return null;
    const count = Number(rawCount);
    const ttl = Number(payload[2]?.result ?? options.windowMs);
    if (!Number.isFinite(count) || !Number.isFinite(ttl)) return null;
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

async function databaseLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const key = opaqueKey(options.key);
  const windowMs = Math.max(1, Math.floor(options.windowMs));
  const rows = await prisma.$queryRaw<DbBucket[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, NOW() + (${windowMs} * INTERVAL '1 millisecond'), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW()
          THEN NOW() + (${windowMs} * INTERVAL '1 millisecond')
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `;
  const bucket = rows[0];
  if (!bucket) throw new Error("Rate-limit bucket update returned no row.");

  globalStore.__rateLimitCleanupCount = (globalStore.__rateLimitCleanupCount ?? 0) + 1;
  if (globalStore.__rateLimitCleanupCount % 100 === 0) {
    await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  }

  const resetAt = bucket.resetAt.getTime();
  return {
    success: bucket.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    resetAt,
  };
}

async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const distributed = await upstashLimit(options);
  if (distributed) return distributed;

  if (process.env.NODE_ENV !== "production") {
    try {
      return await databaseLimit(options);
    } catch {
      return memoryLimit(options);
    }
  }

  try {
    return await databaseLimit(options);
  } catch {
    throw new AppError(
      "RATE_LIMIT_UNAVAILABLE",
      "Security checks are temporarily unavailable. Please try again shortly.",
      503,
    );
  }
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
  review: { limit: 3, windowMs: 60 * 60_000 },
  lookup: { limit: 10, windowMs: 15 * 60_000 },
  wishlist: { limit: 60, windowMs: 15 * 60_000 },
  cartMutation: { limit: 60, windowMs: 10 * 60_000 },
  accountMutation: { limit: 60, windowMs: 15 * 60_000 },
  upload: { limit: 40, windowMs: 10 * 60_000 },
  export: { limit: 20, windowMs: 10 * 60_000 },
  api: { limit: 120, windowMs: 60_000 },
  cspReport: { limit: 30, windowMs: 60_000 },
} as const;

export async function clientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const ip = extractClientIp(headerList);
  if (!ip && process.env.NODE_ENV === "production") {
    throw new AppError(
      "RATE_LIMIT_UNAVAILABLE",
      "A secure client address is unavailable. Please try again shortly.",
      503,
    );
  }
  return ip ?? "unknown";
}
