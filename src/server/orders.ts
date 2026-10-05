import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/checkout";
import { getCartForCheckout } from "@/server/cart";
import { resolveDeliveryRate } from "@/server/delivery";
import { validateCoupon, isFirstOrder, consumeCoupon } from "@/server/coupons";
import { resolveBestPromotion } from "@/server/promotions";
import { decrementStock } from "@/server/inventory";
import { assessOrderRisk } from "@/server/risk";
import { getSettings } from "@/lib/settings";
import { getCustomerSession } from "@/lib/auth/session";
import { hashPassword, passwordIssues } from "@/lib/auth/password";
import { signOrderToken } from "@/lib/order-token";
import { processPendingOrderOutbox } from "@/server/order-outbox";
import { after } from "next/server";
import type { DeliveryMethod } from "@prisma/client";

export type CreateOrderResult = {
  orderId: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  discount: number;
  promotionDiscount: number;
  promotionName: string | null;
  shipping: number;
  firstName: string;
  phone: string;
  wilayaName: string;
  communeName: string;
  address: string;
  deliveryMethod: DeliveryMethod;
  trackingToken: string;
  isDuplicate: boolean;
};

const DUPLICATE_WINDOW_MS = 15 * 60_000;
const OPEN_FOR_DUPLICATE = ["PENDING", "CONFIRMED", "PROCESSING"] as const;
const ORDER_OUTBOX_KINDS = ["ORDER_ANALYTICS", "CUSTOMER_NOTIFICATION", "META_PURCHASE"] as const;

type CreateOrderContext = {
  ip: string | null;
  userAgent: string | null;
};

export async function createOrder(
  rawInput: CheckoutInput,
  context: CreateOrderContext,
): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Please review the highlighted fields and try again.");
  }
  const data = parsed.data;

  const settings = await getSettings();
  if (!settings.commerce.codEnabled) {
    throw new AppError("COD_DISABLED", "Cash on delivery is temporarily unavailable.", 503);
  }

  const placed = await prisma.$transaction(async (tx) => {
    // Read the cart even if it is already converted so a lost response can be recovered.
    const { cartId, customerId: cartCustomerId, status: cartStatus, lines } = await getCartForCheckout(tx, {
      includeInactive: true,
    });
    const session = await getCustomerSession();
    if (cartCustomerId && session && cartCustomerId !== session.customer.id) {
      throw new AppError("CART_NOT_OWNED", "Please refresh your bag before placing this order.", 403);
    }
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) {
      throw new AppError("CONFIG", "Checkout is temporarily unavailable.", 503);
    }
    const idempotencyKey = `checkout:${createHmac("sha256", secret)
      .update(`${cartId}:${data.idempotencyKey}`)
      .digest("hex")}`;

    const prior = await tx.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
    const savedResponse = prior?.response as unknown as Partial<CreateOrderResult> | null;
    if (savedResponse && typeof savedResponse.orderNumber === "string") {
      const replay: CreateOrderResult = {
        ...(savedResponse as CreateOrderResult),
        trackingToken: signOrderToken(savedResponse.orderNumber),
        isDuplicate: true,
      };
      await tx.idempotencyKey.update({ where: { key: idempotencyKey }, data: { response: replay as never } });
      return { replay: true as const, result: replay };
    }

    const existingOrder = await tx.order.findUnique({
      where: { idempotencyKey },
      include: { promotion: { select: { name: true } } },
    });
    if (existingOrder) {
      const recovered: CreateOrderResult = {
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        total: existingOrder.total,
        subtotal: existingOrder.subtotal,
        discount: existingOrder.discount,
        promotionDiscount: existingOrder.promotionDiscount,
        promotionName: existingOrder.promotion?.name ?? null,
        shipping: existingOrder.shipping,
        firstName: existingOrder.firstName,
        phone: existingOrder.phone,
        wilayaName: existingOrder.wilayaName,
        communeName: existingOrder.communeName,
        address: existingOrder.address,
        deliveryMethod: existingOrder.deliveryMethod,
        trackingToken: signOrderToken(existingOrder.orderNumber),
        isDuplicate: true,
      };
      if (prior) {
        await tx.idempotencyKey.update({ where: { key: idempotencyKey }, data: { response: recovered as never } });
      } else {
        await tx.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            scope: "checkout",
            expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
            response: recovered as never,
          },
        });
      }
      return { replay: true as const, result: recovered };
    }

    if (prior) await tx.idempotencyKey.delete({ where: { key: idempotencyKey } });
    if (cartStatus !== "ACTIVE") {
      throw new AppError("CART_ALREADY_CHECKED_OUT", "Your bag has already been checked out.", 409);
    }
    await tx.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        scope: "checkout",
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
    });

    // All authoritative cart, catalog, delivery, promotion and coupon reads use tx.

    const wilaya = await tx.wilaya.findUnique({ where: { id: data.wilayaId } });
    if (!wilaya || !wilaya.isActive) {
      throw new AppError("INVALID_WILAYA", "Please select your wilaya.", 400);
    }
    const commune = await tx.commune.findFirst({
      where: { id: data.communeId, wilayaId: wilaya.id, isActive: true },
    });
    if (!commune) {
      throw new AppError("INVALID_COMMUNE", "Please select a valid commune for this wilaya.", 400);
    }

    const variants = await tx.productVariant.findMany({
      where: { id: { in: lines.map((line) => line.variantId) }, isActive: true },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            status: true,
            publishedAt: true,
            price: true,
            collectionLinks: { select: { collectionId: true } },
          },
        },
        inventory: true,
      },
    });
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const freshLines = lines.map((line) => {
      const variant = variantById.get(line.variantId);
      if (
        !variant ||
        variant.product.status !== "ACTIVE" ||
        (variant.product.publishedAt !== null && variant.product.publishedAt > new Date())
      ) {
        throw new AppError(
          "PRODUCT_UNAVAILABLE",
          `"${line.productName}" is no longer available.`,
          409,
        );
      }
      const available = (variant.inventory?.stock ?? 0) - (variant.inventory?.reserved ?? 0);
      if (available < line.quantity) {
        throw new AppError(
          "OUT_OF_STOCK",
          `"${line.productName}" only has ${available} left in stock.`,
          409,
        );
      }
      const unitPrice = variant.price ?? variant.product.price;
      return {
        variantId: variant.id,
        productId: variant.product.id,
        productName: variant.product.name,
        variantLabel: variant.optionLabel,
        sku: variant.sku,
        imageUrl: variant.imageUrl,
        unitPrice,
        quantity: line.quantity,
        lineTotal: unitPrice * line.quantity,
        collectionIds: variant.product.collectionLinks.map((entry) => entry.collectionId),
      };
    });
    const subtotal = freshLines.reduce((sum, line) => sum + line.lineTotal, 0);

    const promotion = await resolveBestPromotion(
      freshLines.map((line) => ({
        productId: line.productId,
        collectionIds: line.collectionIds,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
      })),
      new Date(),
      tx,
    );
    const promotionDiscount = promotion?.discount ?? 0;
    const promotionId = promotion?.promotionId ?? null;
    const postPromoSubtotal = Math.max(0, subtotal - promotionDiscount);

    // The free-shipping threshold is evaluated after the promotion, per the pricing rules.
    const rate = await resolveDeliveryRate(wilaya.id, data.deliveryMethod, tx);
    const shipping =
      settings.commerce.freeDeliveryThreshold > 0 &&
      postPromoSubtotal >= settings.commerce.freeDeliveryThreshold
        ? 0
        : rate.price;

    // Coupon first-order eligibility and customer creation must observe a
    // committed order for this phone. PostgreSQL transaction-scoped advisory
    // locks serialize only competing checkouts for the same normalized phone.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${data.phone}, 0))`;

    const sessionCustomerId = session?.customer.id ?? cartCustomerId ?? null;
    const customer = sessionCustomerId
      ? await tx.customer.findUnique({ where: { id: sessionCustomerId } })
      : await tx.customer.findUnique({ where: { phone: data.phone } });

    let discount = 0;
    let couponId: string | null = null;
    if (data.couponCode) {
      const first = await isFirstOrder({
        phone: data.phone,
        customerId: customer?.id ?? null,
        db: tx,
      });
      const validation = await validateCoupon({
        code: data.couponCode,
        lines: freshLines.map((line, index) => ({
          productId: line.productId,
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          lineTotal: promotion?.lineTotalsAfterPromotion[index],
          collectionIds: line.collectionIds,
        })),
        subtotal: postPromoSubtotal,
        wilayaId: wilaya.id,
        phone: data.phone,
        customerId: customer?.id ?? null,
        isFirstOrder: first,
        db: tx,
      });
      discount = validation.discount;
      couponId = validation.couponId;
      await consumeCoupon(tx, {
        couponId,
        phone: data.phone,
        customerId: customer?.id ?? null,
      });
    }

    const total = Math.max(0, postPromoSubtotal - discount + shipping);
    if (!data.allowDuplicate) {
      const recent = await tx.order.findMany({
        where: {
          phone: data.phone,
          createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
          status: { in: [...OPEN_FOR_DUPLICATE] },
        },
        select: { orderNumber: true, total: true },
      });
      const match = recent.find((order) => order.total === total);
      if (match) {
        throw new AppError(
          "DUPLICATE_ORDER",
          "We already received a similar order from this number a moment ago. Tick “order anyway” to place it again.",
          409,
          { orderNumber: match.orderNumber },
        );
      }
    }

    const risk = await assessOrderRisk({
      phone: data.phone,
      customerId: customer?.id ?? null,
      total,
      itemCount: freshLines.length,
      db: tx,
    });

    let passwordHash: string | null = null;
    if (data.createAccount) {
      if (!data.email)
        throw new AppError("EMAIL_REQUIRED", "An email address is required to create an account.");
      if (!data.password || passwordIssues(data.password).length > 0) {
        throw new AppError(
          "WEAK_PASSWORD",
          "Choose a stronger password (10+ chars, mixed case, number).",
        );
      }
      if (customer?.passwordHash) {
        throw new AppError(
          "ACCOUNT_EXISTS",
          "An account already exists with this phone number. Please sign in instead.",
          409,
        );
      }
      passwordHash = await hashPassword(data.password);
    }

    let customerId: string | null = customer?.id ?? null;
    if (customerId) {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email ?? undefined,
          lastOrderAt: new Date(),
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
    } else {
      const created = await tx.customer.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email ?? null,
          passwordHash,
          riskLevel: risk.level,
        },
      });
      customerId = created.id;
    }

    const year = new Date().getFullYear();
    const counterRows = await tx.$queryRaw<Array<{ value: number }>>`
      INSERT INTO "Counter" ("key", "value") VALUES (${`order:${year}`}, 1)
      ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
      RETURNING "value"
    `;
    const sequence = counterRows[0]?.value ?? Math.floor(Date.now() / 1000);
    const orderNumber = `${settings.commerce.orderPrefix}-${year}-${String(sequence).padStart(6, "0")}`;

    const order = await tx.order.create({
      data: {
        orderNumber,
        status: "PENDING",
        customerId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email ?? null,
        wilayaId: wilaya.id,
        communeId: commune.id,
        wilayaName: wilaya.name,
        communeName: commune.name,
        address: data.address,
        notes: data.notes ?? null,
        deliveryMethod: data.deliveryMethod,
        subtotal,
        discount,
        shipping,
        total,
        couponId,
        promotionId,
        promotionDiscount,
        riskLevel: risk.level,
        riskScore: risk.score,
        riskFlags: risk.flags,
        ip: context.ip,
        userAgent: context.userAgent,
        idempotencyKey,
        items: {
          create: freshLines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            productName: line.productName,
            variantLabel: line.variantLabel,
            sku: line.sku,
            imageUrl: line.imageUrl,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          })),
        },
        statusHistory: {
          create: {
            status: "PENDING",
            note: "Order placed (cash on delivery).",
            isCustomerVisible: true,
          },
        },
      },
      include: { items: true },
    });

    for (const line of freshLines) {
      await decrementStock(tx, {
        variantId: line.variantId,
        quantity: line.quantity,
        orderId: order.id,
        reason: `Order ${orderNumber}`,
      });
      await tx.product.update({
        where: { id: line.productId },
        data: { soldCount: { increment: line.quantity } },
      });
    }

    if (couponId) {
      await tx.couponRedemption.create({
        data: {
          couponId,
          orderId: order.id,
          customerId,
          phone: data.phone,
          amount: discount,
        },
      });
    }

    const converted = await tx.cart.updateMany({
      where: { id: cartId, status: "ACTIVE" },
      data: { status: "CONVERTED", customerId },
    });
    if (converted.count !== 1) {
      throw new AppError("CART_ALREADY_CHECKED_OUT", "Your bag has already been checked out.", 409);
    }
    await tx.orderOutboxEvent.createMany({
      data: ORDER_OUTBOX_KINDS.map((kind) => ({ orderId: order.id, kind })),
    });
    await tx.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: "ORDER_CREATED",
        resource: "Order",
        resourceId: order.id,
        ip: context.ip,
        userAgent: context.userAgent,
        metadata: { orderNumber, total, itemCount: freshLines.length },
      },
    });

    const result: CreateOrderResult = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total,
      subtotal,
      discount,
      promotionDiscount,
      promotionName: promotion?.name ?? null,
      shipping,
      firstName: data.firstName,
      phone: data.phone,
      wilayaName: wilaya.name,
      communeName: commune.name,
      address: data.address,
      deliveryMethod: data.deliveryMethod,
      trackingToken: signOrderToken(order.orderNumber),
      isDuplicate: false,
    };
    await tx.idempotencyKey.update({
      where: { key: idempotencyKey },
      data: { response: result as never },
    });

    return {
      replay: false as const,
      result,
      customerId,
    };
  });

  if (placed.replay) {
    after(async () => {
      await processPendingOrderOutbox({ orderId: placed.result.orderId });
    });
    return placed.result;
  }
  const result = placed.result;

  after(async () => {
    await processPendingOrderOutbox({ orderId: result.orderId });
  });

  return result;
}

export type OrderConfirmation = {
  orderNumber: string;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "PACKED"
    | "SHIPPED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | "RETURNED"
    | "FAILED_DELIVERY";
  firstName: string;
  lastName: string;
  phone: string;
  wilayaName: string;
  communeName: string;
  address: string;
  deliveryMethod: DeliveryMethod;
  subtotal: number;
  discount: number;
  promotionDiscount: number;
  promotionName: string | null;
  shipping: number;
  total: number;
  placedAt: Date;
  items: Array<{
    productName: string;
    variantLabel: string | null;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  history: Array<{ status: string; note: string | null; createdAt: Date }>;
};

/** Public confirmation lookup — the caller must verify the signed tracking token first. */
export async function getOrderConfirmation(orderNumber: string): Promise<OrderConfirmation | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        promotion: { select: { name: true } },
        statusHistory: {
          where: { isCustomerVisible: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!order) return null;
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      firstName: order.firstName,
      lastName: order.lastName,
      phone: order.phone,
      wilayaName: order.wilayaName,
      communeName: order.communeName,
      address: order.address,
      deliveryMethod: order.deliveryMethod,
      subtotal: order.subtotal,
      discount: order.discount,
      promotionDiscount: order.promotionDiscount,
      promotionName: order.promotion?.name ?? null,
      shipping: order.shipping,
      total: order.total,
      placedAt: order.placedAt,
      items: order.items,
      history: order.statusHistory.map((entry) => ({
        status: entry.status,
        note: entry.note,
        createdAt: entry.createdAt,
      })),
    };
  } catch (error) {
    console.error("[orders] confirmation lookup failed", error instanceof Error ? error.name : "unknown");
    return null;
  }
}
