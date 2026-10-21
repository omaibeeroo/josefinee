import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  assertSameOrigin: vi.fn(),
  enforceRateLimit: vi.fn(),
  storeImage: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("@/lib/auth/rbac", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/lib/csrf", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  LIMITS: { upload: { limit: 10, windowMs: 60_000 } },
}));
vi.mock("@/lib/storage", () => ({ storeImage: mocks.storeImage }));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/i18n/server", () => ({
  getAdminActionT: vi.fn(async () => ({
    signInRequired: "Please sign in.",
    forbidden: "Forbidden.",
    wentWrong: "Something went wrong.",
  })),
}));

import { POST } from "./route";

function request() {
  return new Request("https://store.example.test/api/admin/upload", { method: "POST" });
}

describe("admin upload authorization boundary", () => {
  it("blocks a must-change-password session before same-origin, rate-limit, or storage work", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new AppError("FORBIDDEN", "Change your password before using the admin panel.", 403),
    );

    const response = await POST(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Forbidden." });
    expect(mocks.assertSameOrigin).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.storeImage).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("blocks an unverified SUPER_ADMIN session before upload side effects", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new AppError("FORBIDDEN", "Multi-factor authentication is required for this action.", 403),
    );

    const response = await POST(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Forbidden." });
    expect(mocks.assertSameOrigin).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.storeImage).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
