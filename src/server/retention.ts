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

  // Small expiry-driven tables purge in one shot. Large operational tables
  // purge in bounded batches so a 90/180-day backlog can never lock, time
  // out, or OOM the scheduled job.
  const BATCH_SIZE = 1000;
  async function deleteIdsInBatches(
    listIds: () => Promise<Array<{ id: string }>>,
    removeIds: (ids: string[]) => Promise<{ count: number }>,
  ): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await listIds();
      if (batch.length === 0) break;
      const ids = batch.map((row) => row.id);
      total += (await removeIds(ids)).count;
      if (batch.length < BATCH_SIZE) break;
    }
    return total;
  }

  const [adminSessions, customerSessions, carts, idempotencyKeys, rateLimitBuckets] =
    await Promise.all([
      prisma.adminSession.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.customerSession.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.cart.updateMany({
        where: { status: "ACTIVE", expiresAt: { lt: now } },
        data: { status: "ABANDONED" },
      }),
      prisma.idempotencyKey.deleteMany({ where: { expiresAt: { not: null, lt: now } } }),
      prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } }),
    ]);
  const analyticsEvents = await deleteIdsInBatches(
    () =>
      prisma.analyticsEvent.findMany({
        where: { createdAt: { lt: analyticsCutoff } },
        select: { id: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
      }),
    (ids) => prisma.analyticsEvent.deleteMany({ where: { id: { in: ids } } }),
  );
  const notifications = await deleteIdsInBatches(
    () =>
      prisma.notification.findMany({
        where: {
          status: { in: ["SENT", "FAILED", "SKIPPED"] },
          createdAt: { lt: notificationCutoff },
        },
        select: { id: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
      }),
    (ids) => prisma.notification.deleteMany({ where: { id: { in: ids } } }),
  );
  const outboxEvents = await deleteIdsInBatches(
    () =>
      prisma.orderOutboxEvent.findMany({
        where: { status: "COMPLETED", completedAt: { lt: outboxCutoff } },
        select: { id: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
      }),
    (ids) => prisma.orderOutboxEvent.deleteMany({ where: { id: { in: ids } } }),
  );

  return {
    adminSessions: adminSessions.count,
    customerSessions: customerSessions.count,
    carts: carts.count,
    idempotencyKeys: idempotencyKeys.count,
    rateLimitBuckets: rateLimitBuckets.count,
    analyticsEvents,
    notifications,
    outboxEvents,
  };
}
