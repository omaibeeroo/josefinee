import "server-only";
import { prisma } from "@/lib/prisma";

export type DateRange = { from: Date; to: Date };

export function resolveRange(preset: string, customFrom?: string, customTo?: string): DateRange {
  const to = new Date();
  if (preset === "today") {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (preset === "custom" && customFrom && customTo) {
    return { from: new Date(customFrom), to: new Date(customTo) };
  }
  const days = preset === "90" ? 90 : preset === "7" ? 7 : 30;
  return { from: new Date(Date.now() - days * 24 * 60 * 60_000), to };
}

export async function getDashboardStats(range: DateRange) {
  const inRange = { gte: range.from, lte: range.to };

  const [
    revenue,
    orders,
    pending,
    lowStock,
    outOfStock,
    topProducts,
    byWilaya,
    statusBreakdown,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "DELIVERED", createdAt: inRange },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { createdAt: inRange },
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.inventory.count({
      where: { stock: { gt: 0 }, reserved: 0 },
    }),
    prisma.inventory.count({ where: { stock: 0 } }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { soldCount: "desc" },
      take: 5,
      select: { id: true, name: true, slug: true, soldCount: true, price: true },
    }),
    prisma.order.groupBy({
      by: ["wilayaName"],
      where: { createdAt: inRange },
      _count: true,
      _sum: { total: true },
      orderBy: { _count: { wilayaName: "desc" } },
      take: 8,
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: { createdAt: inRange },
      _count: true,
    }),
  ]);

  const statuses = new Map(statusBreakdown.map((entry) => [entry.status, entry._count]));
  const cancelled = (statuses.get("CANCELLED") ?? 0) + (statuses.get("RETURNED") ?? 0);
  const failed = statuses.get("FAILED_DELIVERY") ?? 0;
  const delivered = statuses.get("DELIVERED") ?? 0;
  const totalOrders = orders._count;

  return {
    revenue: revenue._sum.total ?? 0,
    deliveredOrders: revenue._count,
    orderCount: totalOrders,
    grossTotal: orders._sum.total ?? 0,
    averageOrderValue: Math.round(orders._avg.total ?? 0),
    pendingOrders: pending,
    lowStockCount: lowStock,
    outOfStockCount: outOfStock,
    cancellationRate: totalOrders > 0 ? Math.round(((cancelled + failed) / totalOrders) * 100) : 0,
    failedDeliveries: failed,
    deliveredRate: totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 0,
    topProducts,
    salesByWilaya: byWilaya.map((entry) => ({
      wilaya: entry.wilayaName,
      orders: entry._count,
      total: entry._sum.total ?? 0,
    })),
  };
}

export async function getOrdersSeries(range: DateRange): Promise<Array<{ date: string; orders: number; revenue: number }>> {
  const days: Array<{ date: string; orders: number; revenue: number }> = [];
  const cursor = new Date(range.from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(range.to);
  end.setHours(23, 59, 59, 999);

  while (days.length < 92 && cursor <= end) {
    days.push({ date: cursor.toISOString().slice(0, 10), orders: 0, revenue: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  if (days.length === 0) return days;

  // Per-day breakdown via a lightweight raw query (Postgres).
  const rows = await prisma.$queryRaw<Array<{ day: Date; orders: bigint; revenue: bigint }>>`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS orders,
           COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN total ELSE 0 END), 0)::bigint AS revenue
    FROM "Order"
    WHERE "createdAt" >= ${new Date(`${days[0]?.date ?? "2000-01-01"}T00:00:00`)} AND "createdAt" <= ${end}
    GROUP BY 1 ORDER BY 1
  `;

  const byDay = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), row]));
  return days.map((day) => {
    const found = byDay.get(day.date);
    return {
      date: day.date,
      orders: found ? Number(found.orders) : 0,
      revenue: found ? Number(found.revenue) : 0,
    };
  });
}

export async function getLowStockProducts(limit = 20) {
  const rows = await prisma.inventory.findMany({
    where: { stock: { lte: 5 } },
    orderBy: { stock: "asc" },
    take: limit,
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          optionLabel: true,
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  return rows.map((row) => ({
    variantId: row.variantId,
    sku: row.variant.sku,
    stock: row.stock,
    reserved: row.reserved,
    threshold: row.lowStockThreshold,
    productName: row.variant.product.name,
    productSlug: row.variant.product.slug,
    productId: row.variant.product.id,
    optionLabel: row.variant.optionLabel,
  }));
}
