import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

type DbClient = typeof prisma | Prisma.TransactionClient;

export type CouponLine = {
  productId: string;
  unitPrice: number;
  quantity: number;
  collectionIds?: string[];
};

export type CouponValidation = {
  couponId: string;
  code: string;
  discount: number;
};

/**
 * Validates a coupon entirely server-side. The client can never dictate the
 * discount — it only submits the code.
 */
export async function validateCoupon(params: {
  code: string;
  lines: CouponLine[];
  subtotal: number;
  wilayaId: string;
  phone: string;
  customerId?: string | null;
  isFirstOrder: boolean;
  /** Used only for bag previews — final checkout always enforces everything. */
  skipWilayaCheck?: boolean;
  db?: DbClient;
}): Promise<CouponValidation> {
  const code = params.code.trim().toUpperCase();
  const db = params.db ?? prisma;
  const coupon = await db.coupon.findUnique({
    where: { code },
    include: {
      products: true,
      collections: true,
      wilayas: true,
    },
  });

  if (!coupon || !coupon.isActive) {
    throw new AppError("COUPON_INVALID", "This promo code is not valid.");
  }

  const now = new Date(); // server clock only — never trust the client
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new AppError("COUPON_NOT_STARTED", "This promo code is not active yet.");
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    throw new AppError("COUPON_EXPIRED", "This promo code has expired.");
  }
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    throw new AppError("COUPON_USED_UP", "This promo code has reached its limit.");
  }
  if (coupon.firstOrderOnly && !params.isFirstOrder) {
    throw new AppError("COUPON_FIRST_ORDER", "This promo code is for first orders only.");
  }
  if (coupon.perCustomerLimit !== null && coupon.perCustomerLimit > 0) {
    const used = await db.couponRedemption.count({
      where: {
        couponId: coupon.id,
        OR: [
          { phone: params.phone },
          ...(params.customerId ? [{ customerId: params.customerId }] : []),
        ],
      },
    });
    if (used >= coupon.perCustomerLimit) {
      throw new AppError("COUPON_LIMIT_REACHED", "You have already used this promo code.");
    }
  }
  if (coupon.minOrder !== null && params.subtotal < coupon.minOrder) {
    throw new AppError(
      "COUPON_MIN_ORDER",
      `This promo code requires a minimum order of ${coupon.minOrder} DA.`,
    );
  }
  if (
    coupon.wilayas.length > 0 &&
    !params.skipWilayaCheck &&
    !coupon.wilayas.some((entry) => entry.wilayaId === params.wilayaId)
  ) {
    throw new AppError("COUPON_WILAYA", "This promo code is not available in your region.");
  }

  const productIds = new Set(coupon.products.map((entry) => entry.productId));
  const collectionIds = new Set(coupon.collections.map((entry) => entry.collectionId));

  const eligibleSubtotal = Math.min(
    coupon.appliesToAll
      ? params.subtotal
      : params.lines
          .filter(
            (line) =>
              productIds.has(line.productId) ||
              line.collectionIds?.some((id) => collectionIds.has(id)),
          )
          .reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    params.subtotal,
  );

  if (eligibleSubtotal <= 0) {
    throw new AppError("COUPON_NOT_APPLICABLE", "This promo code does not apply to your bag.");
  }

  let discount =
    coupon.type === "PERCENTAGE"
      ? Math.floor((eligibleSubtotal * coupon.value) / 100)
      : coupon.value;

  if (coupon.maxDiscount !== null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  discount = Math.min(discount, eligibleSubtotal);

  if (discount <= 0) {
    throw new AppError("COUPON_INVALID", "This promo code cannot be applied.");
  }

  return { couponId: coupon.id, code: coupon.code, discount };
}

export async function isFirstOrder(params: {
  phone: string;
  customerId?: string | null;
  db?: DbClient;
}): Promise<boolean> {
  const existing = await (params.db ?? prisma).order.findFirst({
    where: {
      OR: [
        { phone: params.phone },
        ...(params.customerId ? [{ customerId: params.customerId }] : []),
      ],
      status: { notIn: ["CANCELLED"] },
    },
    select: { id: true },
  });
  return !existing;
}

/** Consume a coupon while holding the database row's usage-limit condition atomically. */
export async function consumeCoupon(
  db: Prisma.TransactionClient,
  params: { couponId: string; phone: string; customerId?: string | null },
): Promise<void> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    UPDATE "Coupon"
    SET "usageCount" = "usageCount" + 1
    WHERE "id" = ${params.couponId}
      AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")
      AND (
        "perCustomerLimit" IS NULL OR "perCustomerLimit" <= 0 OR
        (
          SELECT COUNT(*)
          FROM "CouponRedemption" AS redemption
          WHERE redemption."couponId" = "Coupon"."id"
            AND (redemption."phone" = ${params.phone}
              OR (${params.customerId}::text IS NOT NULL AND redemption."customerId" = ${params.customerId}))
        ) < "perCustomerLimit"
      )
    RETURNING "id"
  `;
  if (rows.length === 0) {
    throw new AppError("COUPON_USED_UP", "This promo code has reached its limit.");
  }
}
