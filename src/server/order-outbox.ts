import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOrderReceived } from "@/lib/notifications";
import { sendMetaPurchase } from "@/lib/meta-capi";
import { trackEvent, ANALYTICS_EVENTS } from "@/server/analytics";

const MAX_ATTEMPTS = 8;
const LEASE_MS = 5 * 60_000;
const MAX_BATCH_SIZE = 100;
const ORDER_OUTBOX_KINDS = ["ORDER_ANALYTICS", "CUSTOMER_NOTIFICATION", "META_PURCHASE"] as const;
type OrderOutboxKind = (typeof ORDER_OUTBOX_KINDS)[number];

function isOrderOutboxKind(kind: string): kind is OrderOutboxKind {
  return (ORDER_OUTBOX_KINDS as readonly string[]).includes(kind);
}

function retryDelayMs(attempt: number): number {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1));
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name.slice(0, 80) : "UnknownError";
}

export async function processPendingOrderOutbox(options: {
  orderId?: string;
  limit?: number;
} = {}): Promise<{ claimed: number; completed: number; failed: number }> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LEASE_MS);
  const limit = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(options.limit ?? 25)));
  const candidates = await prisma.orderOutboxEvent.findMany({
    where: {
      ...(options.orderId ? { orderId: options.orderId } : {}),
      OR: [
        { status: "PENDING", availableAt: { lte: now } },
        { status: "PROCESSING", lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, orderId: true, kind: true, attempts: true },
  });

  let claimed = 0;
  let completed = 0;
  let failed = 0;
  for (const event of candidates) {
    const claim = await prisma.orderOutboxEvent.updateMany({
      where: {
        id: event.id,
        OR: [
          { status: "PENDING", availableAt: { lte: now } },
          { status: "PROCESSING", lockedAt: { lt: staleBefore } },
        ],
      },
      data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
    });
    if (claim.count !== 1) continue;
    claimed += 1;

    const attempt = event.attempts + 1;
    try {
      if (!isOrderOutboxKind(event.kind)) throw new Error("UnknownOutboxKind");
      const order = await prisma.order.findUnique({
        where: { id: event.orderId },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          firstName: true,
          phone: true,
          email: true,
          customerId: true,
          ip: true,
          userAgent: true,
          lastName: true,
          wilayaName: true,
          communeName: true,
          address: true,
          deliveryMethod: true,
          subtotal: true,
          discount: true,
          promotionDiscount: true,
          shipping: true,
          items: {
            select: {
              productName: true,
              variantLabel: true,
              unitPrice: true,
              quantity: true,
              lineTotal: true,
            },
          },
          _count: { select: { items: true } },
        },
      });
      if (!order) throw new Error("OrderNotFound");

      let sentChannels: string[] = [];
      if (event.kind === "ORDER_ANALYTICS") {
        const ok = await trackEvent({
          name: ANALYTICS_EVENTS.ORDER_CREATED,
          props: {
            orderNumber: order.orderNumber,
            total: order.total,
            itemCount: order._count.items,
          },
          customerId: order.customerId,
          ip: order.ip,
          userAgent: order.userAgent,
        });
        if (!ok) throw new Error("AnalyticsPersistenceFailed");
      } else if (event.kind === "CUSTOMER_NOTIFICATION") {
        const delivery = await sendOrderReceived({
          orderId: order.id,
          phone: order.phone,
          email: order.email,
          orderNumber: order.orderNumber,
          firstName: order.firstName,
          lastName: order.lastName,
          wilayaName: order.wilayaName,
          communeName: order.communeName,
          address: order.address,
          deliveryMethod: order.deliveryMethod,
          subtotal: order.subtotal,
          discount: order.discount,
          promotionDiscount: order.promotionDiscount,
          shipping: order.shipping,
          total: order.total,
          items: order.items,
        });
        sentChannels = delivery.sent;
        if (delivery.failed.length > 0) throw new Error("NotificationDeliveryFailed");
      } else {
        const ok = await sendMetaPurchase({
          orderNumber: order.orderNumber,
          total: order.total,
          email: order.email,
          phone: order.phone,
          ip: order.ip,
          userAgent: order.userAgent,
        });
        if (!ok) throw new Error("MetaPurchaseFailed");
      }

      await prisma.$transaction(async (tx) => {
        await tx.orderOutboxEvent.update({
          where: { id: event.id },
          data: { status: "COMPLETED", lockedAt: null, completedAt: new Date(), lastError: null },
        });
        if (event.kind === "CUSTOMER_NOTIFICATION") {
          await tx.auditLog.create({
            data: {
              actorType: "SYSTEM",
              action: "ORDER_NOTIFICATION_SENT",
              resource: "Order",
              resourceId: order.id,
              metadata: { channels: sentChannels },
            },
          });
        }
      });
      completed += 1;
    } catch (error) {
      const name = errorName(error);
      const terminal = attempt >= MAX_ATTEMPTS;
      const retryAt = new Date(Date.now() + retryDelayMs(attempt));
      try {
        await prisma.$transaction(async (tx) => {
          await tx.orderOutboxEvent.update({
            where: { id: event.id },
            data: {
              status: terminal ? "FAILED" : "PENDING",
              availableAt: retryAt,
              lockedAt: null,
              lastError: name,
            },
          });
          if (event.kind === "CUSTOMER_NOTIFICATION") {
            await tx.auditLog.create({
              data: {
                actorType: "SYSTEM",
                action: "ORDER_NOTIFICATION_FAILED",
                resource: "Order",
                resourceId: event.orderId,
                metadata: { attempt, maxAttempts: MAX_ATTEMPTS, retrying: !terminal, error: name },
              },
            });
          }
        });
      } catch (recordError) {
        console.error("[order-outbox] could not record failure", errorName(recordError));
      }
      console.error("[order-outbox] effect failed", event.kind, name, terminal ? "terminal" : "retrying");
      failed += 1;
    }
  }
  return { claimed, completed, failed };
}
