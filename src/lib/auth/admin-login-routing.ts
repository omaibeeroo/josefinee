import { roleRequiresMfa, type RoleNameValue } from "./permissions";

export type ExistingAdminLoginSession = {
  user: {
    mustChangePassword: boolean;
    twoFactorEnabled: boolean;
    role: { name: RoleNameValue };
  };
  session: { mfaVerifiedAt: Date | null };
};

/**
 * Choose a safe destination for an already-authenticated visitor of /admin/login.
 * An unverified session must not be sent to the dashboard: unconfigured MFA goes
 * to enrollment, while configured MFA stays on the form for fresh credentials/TOTP.
 */
export function getAdminLoginRedirect(session: ExistingAdminLoginSession | null): string | null {
  if (!session) return null;
  if (session.user.mustChangePassword) return "/admin/first-login";

  const mfaPending = roleRequiresMfa(session.user.role.name) && !session.session.mfaVerifiedAt;
  if (mfaPending) {
    return session.user.twoFactorEnabled ? null : "/admin/security?mfa=required";
  }

  return "/admin";
}

/** Redirect an authenticated but MFA-pending visitor before the dashboard guard throws 403. */
export function getAdminDashboardRedirect(
  session: ExistingAdminLoginSession | null,
): string | null {
  if (!session) return null;
  if (session.user.mustChangePassword) return "/admin/first-login";
  if (roleRequiresMfa(session.user.role.name) && !session.session.mfaVerifiedAt) {
    return session.user.twoFactorEnabled
      ? "/admin/login?mfa=required"
      : "/admin/security?mfa=required";
  }
  return null;
}
