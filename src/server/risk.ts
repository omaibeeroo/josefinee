import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = typeof prisma | Prisma.TransactionClient;

export type RiskAssessment = {
  level: "LOW" | "MEDIUM" | "HIGH";
  score: number;
  flags: string[];
};

/**
 * Heuristic COD risk scoring. This never auto-rejects a customer — it only
 * flags orders for human review, as required for a fair COD operation.
 */
export async function assessOrderRisk(params: {
  phone: string;
  customerId?: string | null;
  total: number;
  itemCount: number;
  db?: DbClient;
}): Promise<RiskAssessment> {
  const flags: string[] = [];
  let score = 0;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);

  const db = params.db ?? prisma;
  const [previousOrders, samePhoneCustomers] = await Promise.all([
    db.order.findMany({
      where: { phone: params.phone },
      select: { id: true, status: true, total: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // Multiple customer profiles sharing the same phone number.
    db.customer.count({ where: { phone: params.phone } }),
  ]);

  const totalOrders = previousOrders.length;
  const badOrders = previousOrders.filter((order) =>
    ["CANCELLED", "RETURNED", "FAILED_DELIVERY"].includes(order.status),
  ).length;

  if (totalOrders >= 5) {
    flags.push("Repeat customer with many orders");
    score += 5;
  }
  if (badOrders >= 2) {
    flags.push("Previous cancelled/returned/failed deliveries");
    score += 25 + badOrders * 5;
  }

  const recentCount = previousOrders.filter((order) => order.createdAt >= since).length;
  if (recentCount >= 5) {
    flags.push("High order frequency in the last 30 days");
    score += 20;
  }

  const averageOrderValue =
    totalOrders > 0 ? previousOrders.reduce((sum, order) => sum + order.total, 0) / totalOrders : 0;
  if (averageOrderValue > 0 && params.total > averageOrderValue * 4 && params.total > 20_000) {
    flags.push("Order value far above this customer's average");
    score += 15;
  }

  if (params.total > 40_000) {
    flags.push("High order value");
    score += 10;
  }

  if (params.itemCount >= 10) {
    flags.push("Large number of items");
    score += 8;
  }

  if (samePhoneCustomers > 1) {
    flags.push("Multiple customer accounts share this phone number");
    score += 15;
  }

  const level: RiskAssessment["level"] = score >= 45 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";
  return { level, score, flags };
}
