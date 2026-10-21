import "server-only";
import { AppError } from "@/lib/errors";
import { getAdminSession, type AdminSessionUser } from "./session";
import { permissionRequiresMfa, roleRequiresMfa, type PermissionCode } from "./permissions";

export function permissionCodes(user: AdminSessionUser): string[] {
  return user.role.permissions.map((entry) => entry.permission.code);
}

export function can(user: AdminSessionUser, code: PermissionCode): boolean {
  // Pure explicit grants — no name-based bypass. SUPER_ADMIN always holds
  // every code because the seed derives its grants from PERMISSIONS itself.
  return permissionCodes(user).includes(code);
}

export function userRequiresMfa(user: AdminSessionUser): boolean {
  return roleRequiresMfa(user.role.name);
}

export function canAccessPermission(
  user: AdminSessionUser,
  code: PermissionCode,
  mfaVerifiedAt: Date | null | undefined,
): boolean {
  if (!can(user, code)) return false;
  if (user.role.name === "SUPER_ADMIN" || permissionRequiresMfa(code)) {
    return Boolean(mfaVerifiedAt);
  }
  return true;
}

async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    throw new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
  }
  if (session.user.mustChangePassword) {
    throw new AppError("FORBIDDEN", "Change your password before using the admin panel.", 403);
  }
  return session;
}

async function requireAdmin(): Promise<AdminSessionUser> {
  return (await requireAdminSession()).user;
}

export async function requirePermission(code: PermissionCode): Promise<AdminSessionUser> {
  const session = await requireAdminSession();
  if (!canAccessPermission(session.user, code, session.session.mfaVerifiedAt)) {
    if (
      can(session.user, code) &&
      (session.user.role.name === "SUPER_ADMIN" || permissionRequiresMfa(code))
    ) {
      throw new AppError(
        "FORBIDDEN",
        "Multi-factor authentication is required for this action.",
        403,
      );
    }
    throw new AppError("FORBIDDEN", "You do not have permission to do this.", 403);
  }
  return session.user;
}

export { requireAdmin };
export type { PermissionCode };
