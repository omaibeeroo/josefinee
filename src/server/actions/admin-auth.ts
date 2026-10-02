"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminLoginSchema } from "@/lib/validation/auth";
import { hashPassword, isStrongPassword, verifyPassword } from "@/lib/auth/password";
import {
  createAdminSession,
  destroyAdminSession,
  getAdminSession,
  revokeOtherAdminSessions,
} from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/rbac";
import { enforceRateLimit, LIMITS, clientIp } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";
import {
  createTotpSecret,
  decryptSecret,
  encryptSecret,
  qrCodeDataUrl,
  totpUri,
  verifyTotp,
} from "@/lib/auth/totp";
import { getSettings } from "@/lib/settings";
import { z } from "zod";

const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60_000;

function redirectIfPasswordChangeRequired(mustChangePassword: boolean): void {
  if (mustChangePassword) redirect("/admin/first-login");
}

export async function adminLoginAction(input: { email: string; password: string; totp?: string }) {
  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Enter your email and password." };
  }

  const ip = await clientIp();
  try {
    await enforceRateLimit({ ...LIMITS.adminLogin, key: `admin-login:${ip}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { role: true },
  });

  if (!user) {
    return { ok: false as const, error: "Email or password is incorrect." };
  }

  if (user.status === "DISABLED") {
    return { ok: false as const, error: "Email or password is incorrect." };
  }
  if (user.status === "LOCKED" && user.lockedUntil && user.lockedUntil <= new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", failedLoginCount: 0, lockedUntil: null },
    });
  } else if (user.status === "LOCKED" || (user.lockedUntil && user.lockedUntil > new Date())) {
    return { ok: false as const, error: "Account temporarily locked. Try again later." };
  }

  const valid = user.passwordHash
    ? await verifyPassword(user.passwordHash, parsed.data.password)
    : false;

  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCKOUT_MS) : null,
        status: failed >= MAX_FAILED ? "LOCKED" : undefined,
      },
    });
    await recordAudit({
      actorType: "SYSTEM",
      actorUserId: null,
      action: "ADMIN_LOGIN_FAILED",
      resource: "User",
      resourceId: user.id,
      ip,
    });
    return { ok: false as const, error: "Email or password is incorrect." };
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!parsed.data.totp) {
      return {
        ok: false as const,
        error: "Enter your 6-digit authenticator code.",
        needsTotp: true as const,
      };
    }
    let secret: string;
    try {
      secret = decryptSecret(user.twoFactorSecret);
    } catch {
      return {
        ok: false as const,
        error: "Two-factor configuration is invalid. Contact a super admin.",
      };
    }
    if (!verifyTotp(secret, parsed.data.totp)) {
      await recordAudit({
        actorType: "SYSTEM",
        actorUserId: null,
        action: "ADMIN_MFA_FAILED",
        resource: "User",
        resourceId: user.id,
        ip,
      });
      return { ok: false as const, error: "Invalid authenticator code.", needsTotp: true as const };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: ip },
  });
  await recordAudit({
    actorUserId: user.id,
    action: "ADMIN_LOGIN",
    resource: "User",
    resourceId: user.id,
    ip,
  });
  await createAdminSession(user.id);

  if (user.mustChangePassword) redirect("/admin/first-login");
  redirect("/admin");
}

export async function adminLogoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

const firstLoginSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  next: z.string().min(10, "Minimum 10 characters.").max(200),
});

export async function adminFirstLoginAction(input: { current: string; next: string }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const parsed = firstLoginSchema.safeParse(input);
  if (!parsed.success || !isStrongPassword(parsed.data.next)) {
    return {
      ok: false as const,
      error: "Choose a stronger password (10+ chars, mixed case, number).",
    };
  }

  const valid = await verifyPassword(session.user.passwordHash, parsed.data.current);
  if (!valid) return { ok: false as const, error: "Your current password is incorrect." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false },
  });
  await revokeOtherAdminSessions(session.user.id);
  await recordAudit({
    actorUserId: session.user.id,
    action: "ADMIN_PASSWORD_CHANGED",
    resource: "User",
    resourceId: session.user.id,
  });
  redirect("/admin");
}

export async function adminChangePasswordAction(input: { current: string; next: string }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  redirectIfPasswordChangeRequired(session.user.mustChangePassword);
  const parsed = firstLoginSchema.safeParse(input);
  if (!parsed.success || !isStrongPassword(parsed.data.next)) {
    return {
      ok: false as const,
      error: "Choose a stronger password (10+ chars, mixed case, number).",
    };
  }
  const valid = await verifyPassword(session.user.passwordHash, parsed.data.current);
  if (!valid) return { ok: false as const, error: "Your current password is incorrect." };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await hashPassword(parsed.data.next) },
  });
  await revokeOtherAdminSessions(session.user.id);
  await recordAudit({
    actorUserId: session.user.id,
    action: "ADMIN_PASSWORD_CHANGED",
    resource: "User",
    resourceId: session.user.id,
  });
  return { ok: true as const, message: "Your password has been updated." };
}

/* ------------------------------------------------------------ 2FA setup */

const stepUpSchema = z.object({ currentPassword: z.string().min(1).max(200) });

export async function start2faSetupAction(input: { currentPassword: string }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  redirectIfPasswordChangeRequired(session.user.mustChangePassword);
  const parsed = stepUpSchema.safeParse(input);
  if (
    !parsed.success ||
    !(await verifyPassword(session.user.passwordHash, parsed.data.currentPassword))
  ) {
    return { ok: false as const, error: "Current password is incorrect." };
  }

  const secret = createTotpSecret();
  const settings = await getSettings();
  const uri = totpUri(secret, session.user.email, settings.general.name);
  const qr = await qrCodeDataUrl(uri);

  // Store encrypted pending secret until verified.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: encryptSecret(secret), twoFactorEnabled: false },
  });
  await recordAudit({
    actorUserId: session.user.id,
    action: "ADMIN_2FA_SETUP_STARTED",
    resource: "User",
    resourceId: session.user.id,
  });

  return { ok: true as const, qr, secret };
}

export async function confirm2faSetupAction(token: string) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  redirectIfPasswordChangeRequired(session.user.mustChangePassword);
  if (!session.user.twoFactorSecret) return { ok: false as const, error: "Start setup first." };

  let secret: string;
  try {
    secret = decryptSecret(session.user.twoFactorSecret);
  } catch {
    return { ok: false as const, error: "Setup expired. Start again." };
  }

  if (!verifyTotp(secret, token)) {
    return { ok: false as const, error: "Invalid code. Check your authenticator app time." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: true },
  });
  await recordAudit({
    actorUserId: session.user.id,
    action: "ADMIN_2FA_ENABLED",
    resource: "User",
    resourceId: session.user.id,
  });
  return { ok: true as const };
}

export async function disable2faAction(input: { currentPassword: string; token: string }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  redirectIfPasswordChangeRequired(session.user.mustChangePassword);
  const parsed = z
    .object({ currentPassword: z.string().min(1).max(200), token: z.string().regex(/^\d{6}$/) })
    .safeParse(input);
  if (
    !parsed.success ||
    !(await verifyPassword(session.user.passwordHash, parsed.data.currentPassword))
  ) {
    return { ok: false as const, error: "Current password is incorrect." };
  }
  if (!session.user.twoFactorSecret)
    return { ok: false as const, error: "Two-factor authentication is not enabled." };
  try {
    if (!verifyTotp(decryptSecret(session.user.twoFactorSecret), parsed.data.token))
      return { ok: false as const, error: "Authenticator code is invalid." };
  } catch {
    return { ok: false as const, error: "Two-factor configuration is invalid." };
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  await recordAudit({
    actorUserId: session.user.id,
    action: "ADMIN_2FA_DISABLED",
    resource: "User",
    resourceId: session.user.id,
  });
  return { ok: true as const };
}

/* ------------------------------------------------------ Staff management */

export async function listUsersAction() {
  await requirePermission("users:manage");
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      role: { select: { name: true, label: true } },
      twoFactorEnabled: true,
      lastLoginAt: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });
}

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(2).max(100),
  roleName: z.enum([
    "SUPER_ADMIN",
    "ADMIN",
    "ORDER_MANAGER",
    "PRODUCT_MANAGER",
    "CUSTOMER_SUPPORT",
    "ANALYST",
  ]),
  password: z.string().min(10).max(200),
});

export async function createUserAction(input: z.infer<typeof createUserSchema>) {
  const actor = await requirePermission("users:manage");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success || !isStrongPassword(parsed.data.password)) {
    return { ok: false as const, error: "Provide a valid email, name and strong password." };
  }
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { ok: false as const, error: "A user with this email already exists." };

  const role = await prisma.role.findUnique({ where: { name: parsed.data.roleName } });
  if (!role) return { ok: false as const, error: "Unknown role." };

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      roleId: role.id,
      mustChangePassword: true,
    },
  });
  await recordAudit({
    actorUserId: actor.id,
    action: "USER_CREATED",
    resource: "User",
    resourceId: user.id,
    metadata: { email: user.email, role: role.name },
  });
  return { ok: true as const };
}

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "DISABLED") {
  const actor = await requirePermission("users:manage");
  if (actor.id === userId)
    return { ok: false as const, error: "You cannot disable your own account." };
  await prisma.user.update({
    where: { id: userId },
    data: { status, failedLoginCount: 0, lockedUntil: null },
  });
  await prisma.adminSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
  await recordAudit({
    actorUserId: actor.id,
    action: "USER_STATUS_CHANGED",
    resource: "User",
    resourceId: userId,
    metadata: { status },
  });
  return { ok: true as const };
}

export async function resetUserPasswordAction(userId: string, password: string) {
  const actor = await requirePermission("users:manage");
  if (!isStrongPassword(password)) {
    return {
      ok: false as const,
      error: "Password must be 10+ chars with mixed case and a number.",
    };
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await prisma.adminSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
  await recordAudit({
    actorUserId: actor.id,
    action: "USER_PASSWORD_RESET",
    resource: "User",
    resourceId: userId,
  });
  return { ok: true as const };
}
