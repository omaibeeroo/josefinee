import { describe, expect, it } from "vitest";
import {
  getAdminDashboardRedirect,
  getAdminLoginRedirect,
  type ExistingAdminLoginSession,
} from "./admin-login-routing";
import type { RoleNameValue } from "./permissions";

function makeSession(
  overrides: {
    mustChangePassword?: boolean;
    twoFactorEnabled?: boolean;
    role?: RoleNameValue;
    mfaVerifiedAt?: Date | null;
  } = {},
): ExistingAdminLoginSession {
  return {
    user: {
      mustChangePassword: overrides.mustChangePassword ?? false,
      twoFactorEnabled: overrides.twoFactorEnabled ?? false,
      role: { name: overrides.role ?? "ADMIN" },
    },
    session: { mfaVerifiedAt: overrides.mfaVerifiedAt ?? null },
  };
}

describe("getAdminLoginRedirect", () => {
  it("keeps unauthenticated visitors on the login form", () => {
    expect(getAdminLoginRedirect(null)).toBeNull();
  });

  it("sends an MFA-required admin without enrollment to setup", () => {
    expect(getAdminLoginRedirect(makeSession())).toBe("/admin/security?mfa=required");
  });

  it("keeps an enrolled but unverified admin on the login form for fresh TOTP", () => {
    expect(getAdminLoginRedirect(makeSession({ twoFactorEnabled: true }))).toBeNull();
  });

  it("sends a verified admin to the dashboard", () => {
    expect(getAdminLoginRedirect(makeSession({ mfaVerifiedAt: new Date() }))).toBe("/admin");
  });

  it("does not impose MFA on roles that do not require it", () => {
    expect(getAdminLoginRedirect(makeSession({ role: "CUSTOMER_SUPPORT" }))).toBe("/admin");
  });

  it("prioritizes required password changes over MFA setup", () => {
    expect(getAdminLoginRedirect(makeSession({ mustChangePassword: true }))).toBe(
      "/admin/first-login",
    );
  });
});

describe("getAdminDashboardRedirect", () => {
  it("does not change the normal unauthenticated guard path", () => {
    expect(getAdminDashboardRedirect(null)).toBeNull();
  });

  it("routes an unenrolled MFA-required admin directly to security setup", () => {
    expect(getAdminDashboardRedirect(makeSession())).toBe("/admin/security?mfa=required");
  });

  it("routes an enrolled but unverified admin to fresh sign-in", () => {
    expect(getAdminDashboardRedirect(makeSession({ twoFactorEnabled: true }))).toBe(
      "/admin/login?mfa=required",
    );
  });

  it("allows an MFA-verified session to continue through the dashboard permission guard", () => {
    expect(getAdminDashboardRedirect(makeSession({ mfaVerifiedAt: new Date() }))).toBeNull();
  });

  it("does not impose MFA on roles without an MFA requirement", () => {
    expect(getAdminDashboardRedirect(makeSession({ role: "CUSTOMER_SUPPORT" }))).toBeNull();
  });

  it("prioritizes the first-login password change", () => {
    expect(getAdminDashboardRedirect(makeSession({ mustChangePassword: true }))).toBe(
      "/admin/first-login",
    );
  });
});
