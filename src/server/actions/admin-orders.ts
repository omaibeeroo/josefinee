"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AppError, toUserMessage } from "@/lib/errors";
import { requirePermission } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { incrementStock } from "@/server/inventory";
import { sendOrderStatusUpdate, sendShippingNotification } from "@/lib/notifications";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";

const PAGE_SIZE = 20;

import { allowedNextStatuses, type OrderFilters } from "@/server/order-transitions";

export async function listOrders(filters: OrderFilters) {
  await requirePermission("orders:read");
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.OrderWhereInput = {};
  if (filters.status) where.status = filters.status as OrderStatus;
  if (filters.wilayaId) where.wilayaId = filters.wilayaId;
  if (filters.risk) where.riskLevel = filters.risk as "LOW" | "MEDIUM" | "HIGH";
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const to = new Date(filters.to);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }
  if (filters.search) {
    const term = filters.search.trim();
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
      orderBy: { createdAt: "desc" },
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
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
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
  return order;
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
      orderId: z.string().min(1),
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
  note = parsedInput.data.note;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return { ok: false as const, error: "Order not found." };
  if (order.status === status) return { ok: true as const };

  if (!allowedNextStatuses(order.status).includes(status)) {
    return {
      ok: false as const,
      error: `Cannot move an order from ${ORDER_STATUS_LABELS[order.status].label} to ${ORDER_STATUS_LABELS[status].label}.`,
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
      const label = ORDER_STATUS_LABELS[status].customerLabel;
      if (status === "SHIPPED") {
        await sendShippingNotification({
          orderId,
          phone: order.phone,
          email: order.email,
          orderNumber: order.orderNumber,
          firstName: order.firstName,
          total: order.total,
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
    console.error("[admin] status change failed", error);
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function updateAdminNotesAction(orderId: string, notes: string) {
  const actor = await requirePermission("orders:write");
  await prisma.order.update({
    where: { id: orderId },
    data: { adminNotes: notes.slice(0, 4000) || null },
  });
  await recordAudit({
    actorUserId: actor.id,
    action: "ORDER_NOTES_UPDATED",
    resource: "Order",
    resourceId: orderId,
  });
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true as const };
}

export async function exportOrdersCsv(filters: OrderFilters): Promise<string> {
  const actor = await requirePermission("orders:export");

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

  for (const summary of summaries) {
    const full = await prisma.order.findUnique({
      where: { id: summary.id },
      include: { items: true, promotion: { select: { name: true } } },
    });
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
