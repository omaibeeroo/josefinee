import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    rateLimitBucket: { deleteMany: mocks.deleteMany },
  },
}));

import { enforceRateLimit } from "@/lib/rate-limit";

const options = { key: "rate-limit-test-key", limit: 1, windowMs: 60_000 };

describe("production rate-limit enforcement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("AUTH_SECRET", "test-only-auth-secret-for-rate-limit-tests-32chars");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests under the database-backed threshold and rejects the next request", async () => {
    mocks.queryRaw
      .mockResolvedValueOnce([{ count: 1, resetAt: new Date(Date.now() + options.windowMs) }])
      .mockResolvedValueOnce([{ count: 2, resetAt: new Date(Date.now() + options.windowMs) }]);

    await expect(enforceRateLimit(options)).resolves.toBeUndefined();
    await expect(enforceRateLimit(options)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
  });

  it("fails closed with 503 instead of using process-local memory when the database is unavailable", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("database unavailable"));

    await expect(enforceRateLimit(options)).rejects.toMatchObject({
      code: "RATE_LIMIT_UNAVAILABLE",
      status: 503,
    });
    await expect(enforceRateLimit(options)).rejects.toMatchObject({
      code: "RATE_LIMIT_UNAVAILABLE",
      status: 503,
    });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
  });
});
