"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AppError, toUserMessage } from "@/lib/errors";
import { requirePermission } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { incrementStock } from "@/server/inventory";
import { sendOrderStatusUpdate, sendShippingNotification } from "@/lib/notifications";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n/locales";
import dictionaries from "@/lib/i18n";
import { cookies } from "next/headers";
import type { OrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { adminId, orderFilters } from "@/lib/validation/admin";

const PAGE_SIZE = 20;

import { allowedNextStatuses, type OrderFilters } from "@/server/order-transitions";

export async function listOrders(filters: OrderFilters) {
  await requirePermission("orders:read");
  const parsed = orderFilters.safeParse(filters);
  if (!parsed.success) return { items: [], total: 0, page: 1, totalPages: 1 };
  const safeFilters = parsed.data;
  const page = safeFilters.page;

  const where: Prisma.OrderWhereInput = {};
  if (safeFilters.status) where.status = safeFilters.status as OrderStatus;
  if (safeFilters.wilayaId) where.wilayaId = safeFilters.wilayaId;
  if (safeFilters.risk) where.riskLevel = safeFilters.risk;
  if (safeFilters.from || safeFilters.to) {
    where.createdAt = {};
    if (safeFilters.from) where.createdAt.gte = new Date(safeFilters.from);
    if (safeFilters.to) {
      const to = new Date(safeFilters.to);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }
  if (safeFilters.search) {
    const term = safeFilters.search;
    where.OR = [
      { orderNumber: { contains: term, mode: "insensitive" } },
      { phone: { contains: term } },
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        firstName: true,
        lastName: true,
        phone: true,
        wilayaName: true,
        communeName: true,
        total: true,
        riskLevel: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getAdminOrder(id: string) {
  await requirePermission("orders:read");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) throw new AppError("INVALID_INPUT", "Invalid order ID.", 400);
  const order = await prisma.order.findUnique({
    where: { id: parsedId.data },
    include: {
      items: {
        include: {
          product: {
            select: {
              images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
      wilaya: { select: { name: true, code: true } },
      commune: { select: { name: true } },
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true, riskLevel: true },
      },
      coupon: { select: { code: true } },
      promotion: { select: { name: true } },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: { changedByUser: { select: { name: true } } },
      },
      notifications: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found.", 404);
  // Display-only fallback: snapshot imageUrl stays frozen, but the thumbnail
  // shows the product's current primary photo when the snapshot has none.
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      displayImageUrl: item.imageUrl ?? item.product?.images[0]?.url ?? null,
    })),
  };
}

export async function changeOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  note?: string,
  notify = true,
) {
  const actor = await requirePermission("orders:write");
  const parsedInput = z
    .object({
      orderId: adminId,
      status: z.enum([
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "PACKED",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "RETURNED",
        "FAILED_DELIVERY",
      ]),
      note: z.string().max(500).optional(),
      notify: z.boolean(),
    })
    .safeParse({ orderId, status, note, notify });
  if (!parsedInput.success) return { ok: false as const, error: "Invalid order status update." };
  // Use validated values from here on (never the raw arguments).
  orderId = parsedInput.data.orderId;
  status = parsedInput.data.status;
  notify = parsedInput.data.notify;
  note = parsedInput.data.note;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return { ok: false as const, error: "Order not found." };
  if (order.status === status) return { ok: true as const };

  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const t = dictionaries[locale];
  if (!allowedNextStatuses(order.status).includes(status)) {
    return {
      ok: false as const,
      error: `${t.adminOrderDetail.transitionBlocked}: ${t.status[order.status]} → ${t.status[status]}.`,
    };
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const transitioned = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status,
          confirmedAt: status === "CONFIRMED" ? now : undefined,
          deliveredAt: status === "DELIVERED" ? now : undefined,
          cancelledAt: status === "CANCELLED" ? now : undefined,
        },
      });
      if (transitioned.count !== 1) throw new Error("The order was changed by another request.");
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status,
          note: note || null,
          changedByUserId: actor.id,
          isCustomerVisible: true,
        },
      });

      if (status === "CANCELLED" || status === "RETURNED") {
        for (const item of order.items) {
          if (item.variantId) {
            await incrementStock(tx, {
              variantId: item.variantId,
              quantity: item.quantity,
              type: status === "CANCELLED" ? "RELEASE" : "RETURN",
              orderId,
              reason: `Order ${status.toLowerCase()} ${order.orderNumber}`,
              userId: actor.id,
            });
          }
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { soldCount: { decrement: item.quantity } },
            });
          }
        }
      }
    });

    if (notify) {
      const label = t.customerStatus[status];
      if (status === "SHIPPED") {
        await sendShippingNotification({
          orderId,
          phone: order.phone,
          email: order.email,
          orderNumber: order.orderNumber,
          firstName: order.firstName,
          total: order.total,
          idempotencyKey: `order-status:${orderId}:${status}`,
        }).catch(() => undefined);
      } else {
        await sendOrderStatusUpdate({
          orderId,
          phone: order.phone,
          email: order.email,
          orderNumber: order.orderNumber,
          firstName: order.firstName,
          total: order.total,
          status: label,
          note,
          idempotencyKey: `order-status:${orderId}:${status}`,
        }).catch(() => undefined);
      }
    }

    await recordAudit({
      actorUserId: actor.id,
      action: "ORDER_STATUS_CHANGED",
      resource: "Order",
      resourceId: orderId,
      metadata: { from: order.status, to: status, note },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true as const };
  } catch (error) {
    console.error("[admin] status change failed", error instanceof Error ? error.name : "unknown");
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function updateAdminNotesAction(orderId: string, notes: string) {
  const actor = await requirePermission("orders:write");
  const parsed = z.object({ orderId: adminId, notes: z.string().max(4000) }).safeParse({ orderId, notes });
  if (!parsed.success) return { ok: false as const, error: "Invalid order note." };
  try {
    await prisma.order.update({
      where: { id: parsed.data.orderId },
      data: { adminNotes: parsed.data.notes.trim() || null },
    });
  } catch {
    return { ok: false as const, error: "Order not found or already changed." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "ORDER_NOTES_UPDATED",
    resource: "Order",
    resourceId: parsed.data.orderId,
  });
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true as const };
}

export async function exportOrdersCsv(filters: OrderFilters): Promise<string> {
  const actor = await requirePermission("orders:export");
  const parsedFilters = orderFilters.safeParse(filters);
  if (!parsedFilters.success) return "";
  filters = parsedFilters.data;

  // Page through every matching order — exports are complete, not truncated.
  const summaries: Awaited<ReturnType<typeof listOrders>>["items"] = [];
  let page = 1;
  for (;;) {
    const chunk = await listOrders({ ...filters, page });
    summaries.push(...chunk.items);
    if (page >= chunk.totalPages) break;
    page += 1;
    if (page > 500) break; // sanity cap: 10,000 orders per export
  }

  const header = [
    "Order number",
    "Date",
    "Customer",
    "Phone",
    "Wilaya",
    "Commune",
    "Address",
    "Products",
    "Quantity",
    "Subtotal",
    "Promotion",
    "Promotion discount",
    "Discount",
    "Delivery",
    "Total",
    "Status",
    "Risk",
  ];
  const lines = [header.join(",")];
  const escape = (value: string | number) => {
    const text = String(value);
    const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const fullOrders = await prisma.order.findMany({
    where: { id: { in: summaries.map((summary) => summary.id) } },
    include: { items: true, promotion: { select: { name: true } } },
  });
  const ordersById = new Map(fullOrders.map((order) => [order.id, order]));
  for (const summary of summaries) {
    const full = ordersById.get(summary.id);
    if (!full) continue;
    const products = full.items
      .map(
        (item) =>
          `${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ""} x${item.quantity}`,
      )
      .join(" | ");
    const quantity = full.items.reduce((sum, item) => sum + item.quantity, 0);
    lines.push(
      [
        escape(full.orderNumber),
        escape(full.placedAt.toISOString()),
        escape(`${full.firstName} ${full.lastName}`),
        escape(full.phone),
        escape(full.wilayaName),
        escape(full.communeName),
        escape(full.address),
        escape(products),
        quantity,
        full.subtotal,
        escape(full.promotion?.name ?? ""),
        full.promotionDiscount,
        full.discount,
        full.shipping,
        full.total,
        full.status,
        full.riskLevel,
      ].join(","),
    );
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "ORDERS_EXPORTED",
    resource: "Order",
    metadata: { count: summaries.length, filters },
  });
  return lines.join("\n");
}
