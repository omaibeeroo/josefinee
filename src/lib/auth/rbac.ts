import "server-only";
import { AppError } from "@/lib/errors";
import { getAdminSession, type AdminSessionUser } from "./session";
import { PERMISSIONS, type PermissionCode } from "./permissions";

export function permissionCodes(user: AdminSessionUser): string[] {
  return user.role.permissions.map((entry) => entry.permission.code);
}

export function can(user: AdminSessionUser, code: PermissionCode): boolean {
  if (user.role.name === "SUPER_ADMIN") return true;
  return permissionCodes(user).includes(code);
}

export async function requireAdmin(): Promise<AdminSessionUser> {
  const session = await getAdminSession();
  if (!session) {
    throw new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
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
