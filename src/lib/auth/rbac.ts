import "server-only";
import { AppError } from "@/lib/errors";
import { getAdminSession, type AdminSessionUser } from "./session";
import { PERMISSIONS, type PermissionCode } from "./permissions";

export function permissionCodes(user: AdminSessionUser): string[] {
  return user.role.permissions.map((entry) => entry.permission.code);
}

export function can(user: AdminSessionUser, code: PermissionCode): boolean {
  // Pure explicit grants — no name-based bypass. SUPER_ADMIN always holds
  // every code because the seed derives its grants from PERMISSIONS itself,
  // so re-running the seed after adding codes keeps it complete. (Covered by
  // rbac.test.ts: exact grants are authoritative for every role.)
  return permissionCodes(user).includes(code);
}

export async function requireAdmin(): Promise<AdminSessionUser> {
  const session = await getAdminSession();
  if (!session) {
    throw new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
  }
  if (session.user.mustChangePassword) {
    throw new AppError("FORBIDDEN", "Change your password before using the admin panel.", 403);
  }
  return session.user;
}

export async function requirePermission(code: PermissionCode): Promise<AdminSessionUser> {
  const user = await requireAdmin();
  if (!can(user, code)) {
    throw new AppError("FORBIDDEN", "You do not have permission to do this.", 403);
  }
  return user;
}

export { PERMISSIONS };
export type { PermissionCode };
