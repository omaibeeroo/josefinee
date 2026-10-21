import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashToken } from "./tokens";

export const ADMIN_RECOVERY_CODE_COUNT = 8;

function normalizeRecoveryCode(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function generateRecoveryCode(): string {
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export async function replaceAdminRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: ADMIN_RECOVERY_CODE_COUNT }, generateRecoveryCode);
  await prisma.$transaction([
    prisma.adminRecoveryCode.deleteMany({ where: { userId } }),
    prisma.adminRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashToken(normalizeRecoveryCode(code)) })),
    }),
  ]);
  return codes;
}

/** Consume a code atomically; a used code can never authenticate twice. */
export async function consumeAdminRecoveryCode(userId: string, code: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length < 8 || normalized.length > 32) return false;
  const result = await prisma.adminRecoveryCode.updateMany({
    where: { userId, codeHash: hashToken(normalized), usedAt: null },
    data: { usedAt: new Date() },
  });
  return result.count === 1;
}

export async function deleteAdminRecoveryCodes(userId: string): Promise<void> {
  await prisma.adminRecoveryCode.deleteMany({ where: { userId } });
}
