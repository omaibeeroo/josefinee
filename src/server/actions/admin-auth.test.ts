import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  executeRaw: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  enforceRateLimit: vi.fn(),
  clientIp: vi.fn(),
  recordAudit: vi.fn(),
  createAdminSession: vi.fn(),
  destroyAdminSession: vi.fn(),
  getAdminSession: vi.fn(),
  markCurrentAdminSessionMfaVerified: vi.fn(),
  revokeOtherAdminSessions: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique, update: mocks.update },
    $executeRaw: mocks.executeRaw,
  },
}));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword,
  isStrongPassword: vi.fn(() => true),
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  clientIp: mocks.clientIp,
  LIMITS: { adminLogin: { limit: 5, windowMs: 900_000 }, login: { limit: 5, windowMs: 900_000 } },
}));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/auth/session", () => ({
  createAdminSession: mocks.createAdminSession,
  destroyAdminSession: mocks.destroyAdminSession,
  getAdminSession: mocks.getAdminSession,
  markCurrentAdminSessionMfaVerified: mocks.markCurrentAdminSessionMfaVerified,
  revokeOtherAdminSessions: mocks.revokeOtherAdminSessions,
}));
vi.mock("@/lib/auth/permissions", () => ({
  roleRequiresMfa: vi.fn(() => false),
}));
vi.mock("@/lib/auth/totp", () => ({
  createTotpSecret: vi.fn(),
  decryptSecret: vi.fn(),
  encryptSecret: vi.fn(),
  qrCodeDataUrl: vi.fn(),
  totpUri: vi.fn(),
  verifyTotp: vi.fn(),
}));
vi.mock("@/lib/auth/recovery", () => ({
  consumeAdminRecoveryCode: vi.fn(),
  deleteAdminRecoveryCodes: vi.fn(),
  replaceAdminRecoveryCodes: vi.fn(),
}));
vi.mock("@/lib/settings", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({
  getActionT: vi.fn(async () => ({
    enterCredentials: "Please enter your email and password.",
    badCredentials: "Email or password is incorrect.",
    rateLimited: "Too many attempts. Please try again later.",
  })),
  getAdminActionT: vi.fn(async () => ({})),
}));

import { adminLoginAction } from "./admin-auth";

describe("admin login locked-account handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clientIp.mockResolvedValue("192.0.2.10");
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.hashPassword.mockResolvedValue("placeholder-password-hash");
  });

  it("keeps unknown-account failures generic after placeholder password work", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    mocks.verifyPassword.mockResolvedValueOnce(false);

    const result = await adminLoginAction({ email: "unknown@example.com", password: "wrong" });

    expect(result).toEqual({ ok: false, error: "Email or password is incorrect." });
    expect(mocks.verifyPassword).toHaveBeenCalledWith("placeholder-password-hash", "wrong");
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("keeps disabled-account failures generic after placeholder password work", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "user-disabled",
      status: "DISABLED",
      passwordHash: "disabled-password-hash",
    });
    mocks.verifyPassword.mockResolvedValueOnce(false);

    const result = await adminLoginAction({ email: "disabled@example.com", password: "wrong" });

    expect(result).toEqual({ ok: false, error: "Email or password is incorrect." });
    expect(mocks.verifyPassword).toHaveBeenCalledWith("placeholder-password-hash", "wrong");
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("keeps ordinary bad-password failures generic while retaining lockout and audit work", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      id: "user-active",
      status: "ACTIVE",
      lockedUntil: null,
      passwordHash: "stored-password-hash",
      role: { name: "ADMIN" },
      twoFactorEnabled: false,
    });
    mocks.verifyPassword.mockResolvedValueOnce(false);

    const result = await adminLoginAction({ email: "active@example.com", password: "wrong" });

    expect(result).toEqual({ ok: false, error: "Email or password is incorrect." });
    expect(mocks.verifyPassword).toHaveBeenCalledWith("stored-password-hash", "wrong");
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ADMIN_LOGIN_FAILED", resourceId: "user-active" }),
    );
  });

  it("keeps locked-account failures generic and performs equalized failure work", async () => {
    mocks.clientIp.mockResolvedValueOnce("192.0.2.10");
    mocks.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "admin@example.com",
      name: "Admin",
      status: "LOCKED",
      lockedUntil: new Date(Date.now() + 60_000),
      passwordHash: "stored-password-hash",
      role: { name: "ADMIN" },
      twoFactorEnabled: false,
      twoFactorSecret: null,
      mustChangePassword: false,
    });
    mocks.verifyPassword.mockResolvedValueOnce(true);

    const result = await adminLoginAction({
      email: "admin@example.com",
      password: "Correct-but-locked-password",
    });

    expect(result).toEqual({ ok: false, error: "Email or password is incorrect." });
    expect(mocks.verifyPassword).toHaveBeenCalledWith(
      "placeholder-password-hash",
      "Correct-but-locked-password",
    );
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_LOGIN_FAILED",
        resourceId: "user-1",
        ip: "192.0.2.10",
      }),
    );
    expect(mocks.createAdminSession).not.toHaveBeenCalled();
  });
});
