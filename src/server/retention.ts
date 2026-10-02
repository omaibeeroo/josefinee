import "server-only";
import { prisma } from "@/lib/prisma";

const DAY_MS = 86_400_000;

function retentionDays(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value >= 1 && value <= 3_650 ? value : fallback;
}

/**
 * Removes only records with an explicit technical expiry or documented
 * operational retention window. Orders and audit logs are intentionally never
 * deleted here; legal retention policy must be handled separately.
 */
export async function purgeExpiredData(): Promise<{
  adminSessions: number;
  customerSessions: number;
  carts: number;
  idempotencyKeys: number;
  rateLimitBuckets: number;
  analyticsEvents: number;
  notifications: number;
  outboxEvents: number;
}> {
  const now = new Date();
  const analyticsCutoff = new Date(now.getTime() - retentionDays("RETENTION_ANALYTICS_DAYS", 90) * DAY_MS);
  const notificationCutoff = new Date(now.getTime() - retentionDays("RETENTION_NOTIFICATION_DAYS", 180) * DAY_MS);
  const outboxCutoff = new Date(now.getTime() - retentionDays("RETENTION_OUTBOX_DAYS", 30) * DAY_MS);

  const [adminSessions, customerSessions, carts, idempotencyKeys, rateLimitBuckets, analyticsEvents, notifications, outboxEvents] = await prisma.$transaction([
    prisma.adminSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.customerSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.cart.updateMany({ where: { status: "ACTIVE", expiresAt: { lt: now } }, data: { status: "ABANDONED" } }),
    prisma.idempotencyKey.deleteMany({ where: { expiresAt: { not: null, lt: now } } }),
    prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } }),
    prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: analyticsCutoff } } }),
    prisma.notification.deleteMany({ where: { status: { in: ["SENT", "FAILED", "SKIPPED"] }, createdAt: { lt: notificationCutoff } } }),
    prisma.orderOutboxEvent.deleteMany({ where: { status: "COMPLETED", completedAt: { lt: outboxCutoff } } }),
  ]);

  return {
    adminSessions: adminSessions.count,
    customerSessions: customerSessions.count,
    carts: carts.count,
    idempotencyKeys: idempotencyKeys.count,
    rateLimitBuckets: rateLimitBuckets.count,
    analyticsEvents: analyticsEvents.count,
    notifications: notifications.count,
    outboxEvents: outboxEvents.count,
  };
}
