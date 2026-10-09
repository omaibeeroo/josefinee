import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { promotionDiscountFor } from "@/lib/promo-math";

type DbClient = typeof prisma | Prisma.TransactionClient;

export type PromoLine = {
  productId: string;
  collectionIds: string[];
  unitPrice: number;
  quantity: number;
};

export type ResolvedPromotion = {
  promotionId: string;
  name: string;
  discount: number;
  lineTotalsAfterPromotion: number[];
};

/**
 * Automatic (code-less) promotions. The single best applicable promotion wins —
 * promotions never stack, which keeps totals predictable and auditable.
 * Evaluated with the server clock; the client can never invent a discount.
 */
async function getActivePromotions(now = new Date(), db: DbClient = prisma) {
  return db.promotion.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    include: {
      products: { select: { productId: true } },
      collection: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    // Active promotions are a handful of rows; the cap only bounds abuse.
    take: 50,
  });
}

export async function resolveBestPromotion(
  lines: PromoLine[],
  now = new Date(),
  db: DbClient = prisma,
): Promise<ResolvedPromotion | null> {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (subtotal <= 0) return null;

  const promotions = await getActivePromotions(now, db);
  let best: ResolvedPromotion | null = null;

  for (const promotion of promotions) {
    const productIds = new Set(promotion.products.map((entry) => entry.productId));
    const scoped = productIds.size > 0 || promotion.collectionId;

    const eligibleIndexes = lines.flatMap((line, index) =>
      !scoped ||
      productIds.has(line.productId) ||
      (promotion.collectionId && line.collectionIds.includes(promotion.collectionId))
        ? [index]
        : [],
    );
    const eligible = eligibleIndexes.reduce(
      (sum, index) => sum + lines[index]!.unitPrice * lines[index]!.quantity,
      0,
    );

    const discount = promotionDiscountFor(promotion, eligible);
    if (discount > 0 && (!best || discount > best.discount)) {
      const lineTotalsAfterPromotion = lines.map((line) => line.unitPrice * line.quantity);
      let remaining = discount;
      for (const [position, index] of eligibleIndexes.entries()) {
        const lineTotal = lineTotalsAfterPromotion[index]!;
        const lineDiscount = position === eligibleIndexes.length - 1
          ? remaining
          : Math.min(remaining, Math.floor((discount * lineTotal) / eligible));
        lineTotalsAfterPromotion[index] = lineTotal - lineDiscount;
        remaining -= lineDiscount;
      }
      best = { promotionId: promotion.id, name: promotion.name, discount, lineTotalsAfterPromotion };
    }
  }

  return best;
}

/** Promotion badge for a product page (informational — applied at checkout). */
export async function getProductPromotion(
  productId: string,
  collectionIds: string[],
): Promise<{ name: string; type: "PERCENTAGE" | "FIXED"; value: number } | null> {
  const now = new Date();
  const promotions = await getActivePromotions(now);
  let best: { name: string; type: "PERCENTAGE" | "FIXED"; value: number; rank: number } | null =
    null;

  for (const promotion of promotions) {
    const productIds = new Set(promotion.products.map((entry) => entry.productId));
    const matches =
      productIds.size === 0 && !promotion.collectionId
        ? true
        : productIds.has(productId) ||
          (promotion.collectionId != null && collectionIds.includes(promotion.collectionId));
    if (!matches) continue;
    const rank = promotion.type === "PERCENTAGE" ? promotion.value : 1000 + promotion.value;
    if (!best || rank > best.rank) {
      best = { name: promotion.name, type: promotion.type, value: promotion.value, rank };
    }
  }

  return best ? { name: best.name, type: best.type, value: best.value } : null;
}
