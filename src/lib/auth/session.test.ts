import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("react", () => ({ cache: (fn: (...args: never[]) => unknown) => fn }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock("@/lib/prisma", () => ({
  prisma: { adminSession: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));
vi.mock("./tokens", () => ({
  generateToken: vi.fn(() => "generated-session-token"),
  hashToken: (token: string) => `hashed:${token}`,
}));

import {
  ADMIN_COOKIE,
  destroyAdminSession,
  getAdminSession,
  revokeOtherAdminSessions,
} from "./session";

function activeSession(overrides: Record<string, unknown> = {}) {
  return {
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    mfaVerifiedAt: new Date(),
    user: {
      id: "staff-1",
      name: "Staff",
      email: "staff@example.test",
      status: "ACTIVE",
      mustChangePassword: false,
      twoFactorEnabled: true,
      role: { name: "ADMIN", label: "Admin", permissions: [] },
    },
    ...overrides,
  };
}

describe("admin session lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.cookies.mockResolvedValue({
      get: (name: string) => (name === ADMIN_COOKIE ? { value: "current-token" } : undefined),
      set: mocks.cookieSet,
    });
    mocks.findUnique.mockResolvedValue(activeSession());
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("loads the current database-backed role for an active session", async () => {
    const result = await getAdminSession();

    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: "hashed:current-token" } }),
    );
    expect(result?.user.id).toBe("staff-1");
    expect(result?.user.role.name).toBe("ADMIN");
  });

  it.each([
    ["revoked", { revokedAt: new Date() }],
    ["expired", { expiresAt: new Date(Date.now() - 1_000) }],
    ["disabled", { user: { ...activeSession().user, status: "DISABLED" } }],
  ])("denies a %s staff session", async (_label, overrides) => {
    mocks.findUnique.mockResolvedValueOnce(activeSession(overrides));

    await expect(getAdminSession()).resolves.toBeNull();
  });

  it("revokes all other sessions for the user while retaining the current token", async () => {
    await revokeOtherAdminSessions("staff-1");

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { userId: "staff-1", tokenHash: { not: "hashed:current-token" } },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("clears the browser cookie even if persistent session revocation fails", async () => {
    mocks.updateMany.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(destroyAdminSession()).rejects.toThrow("database unavailable");
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      ADMIN_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0, httpOnly: true }),
    );
  });
});
