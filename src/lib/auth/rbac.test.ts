import { describe, expect, it } from "vitest";
import { can, permissionCodes } from "@/lib/auth/rbac";
import { PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import type { AdminSessionUser } from "@/lib/auth/session";

function user(roleName: string, codes: string[]): AdminSessionUser {
  return {
    id: "user-1",
    email: "admin@example.com",
    name: "Test Admin",
    status: "ACTIVE",
    passwordHash: "hash",
    roleId: "role-1",
    role: {
      id: "role-1",
      name: roleName,
      label: roleName,
      description: "test",
      permissions: codes.map((code) => ({
        roleId: "role-1",
        permissionId: code,
        permission: { id: code, code, label: code, description: code },
      })),
    },
    twoFactorEnabled: false,
    twoFactorSecret: null,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as AdminSessionUser;
}

describe("admin RBAC", () => {
  it("requires the exact assigned permission even for a SUPER_ADMIN-named role", () => {
    const restricted = user("SUPER_ADMIN", [PERMISSIONS.ORDERS_READ]);

    expect(permissionCodes(restricted)).toEqual([PERMISSIONS.ORDERS_READ]);
    expect(can(restricted, PERMISSIONS.ORDERS_READ)).toBe(true);
    expect(can(restricted, PERMISSIONS.USERS_MANAGE)).toBe(false);
  });

  it("keeps read and write capabilities separate for new admin areas", () => {
    const analyst = user("ANALYST", ROLE_PERMISSIONS.ANALYST);
    const support = user("CUSTOMER_SUPPORT", ROLE_PERMISSIONS.CUSTOMER_SUPPORT);

    expect(can(analyst, PERMISSIONS.ORDERS_READ)).toBe(true);
    expect(can(analyst, PERMISSIONS.ORDERS_WRITE)).toBe(false);
    expect(can(analyst, PERMISSIONS.NEWSLETTER_EXPORT)).toBe(false);
    expect(can(support, PERMISSIONS.MESSAGES_READ)).toBe(true);
    expect(can(support, PERMISSIONS.MESSAGES_WRITE)).toBe(true);
  });

  it("grants promotions independently from coupon permissions", () => {
    const productManager = user("PRODUCT_MANAGER", ROLE_PERMISSIONS.PRODUCT_MANAGER);

    expect(can(productManager, PERMISSIONS.PROMOTIONS_READ)).toBe(true);
    expect(can(productManager, PERMISSIONS.PROMOTIONS_WRITE)).toBe(true);
  });

  it("splits content reads from writes", () => {
    const productManager = user("PRODUCT_MANAGER", ROLE_PERMISSIONS.PRODUCT_MANAGER);
    const support = user("CUSTOMER_SUPPORT", ROLE_PERMISSIONS.CUSTOMER_SUPPORT);

    expect(can(productManager, PERMISSIONS.CONTENT_READ)).toBe(true);
    expect(can(productManager, PERMISSIONS.CONTENT_WRITE)).toBe(true);
    expect(can(support, PERMISSIONS.CONTENT_READ)).toBe(false);
    expect(can(support, PERMISSIONS.CONTENT_WRITE)).toBe(false);
  });
});
