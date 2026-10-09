"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AppError, toUserMessage } from "@/lib/errors";
import { getCustomerSession } from "@/lib/auth/session";
import { signOrderToken } from "@/lib/order-token";
import { z } from "zod";
import { zId, zOptionalString, zPhone } from "@/lib/validation/common";
import { getActionT } from "@/lib/i18n/server";
import { recordAudit } from "@/lib/audit";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { storefrontProductWhere } from "@/server/catalog";

async function requireCustomer() {
  const session = await getCustomerSession();
  if (!session) throw new AppError("UNAUTHORIZED", "Please sign in.", 401);
  return session.customer;
}

export async function getAccountOverview() {
  const customer = await requireCustomer();
  const [orderCount, wishlistCount, latestOrders] = await Promise.all([
    prisma.order.count({ where: { customerId: customer.id } }),
    prisma.wishlistItem.count({ where: { wishlist: { customerId: customer.id } } }),
    prisma.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { orderNumber: true, status: true, total: true, createdAt: true },
    }),
  ]);
  return {
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
    },
    orderCount,
    wishlistCount,
    latestOrders: latestOrders.map((order) => ({
      ...order,
      trackingToken: signOrderToken(order.orderNumber),
    })),
  };
}

export async function getCustomerOrders() {
  const customer = await requireCustomer();
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    select: {
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      items: {
        select: {
          productName: true,
          imageUrl: true,
          quantity: true,
          product: {
            select: {
              images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      imageUrl: item.imageUrl ?? item.product?.images[0]?.url ?? null,
    })),
    trackingToken: signOrderToken(order.orderNumber),
  }));
}

export async function getWishlistItems() {
  const customer = await requireCustomer();
  const items = await prisma.wishlistItem.findMany({
    where: {
      wishlist: { customerId: customer.id },
      product: storefrontProductWhere(),
    },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          price: true,
          compareAtPrice: true,
          images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
          variants: {
            where: { isActive: true },
            orderBy: { position: "asc" },
            take: 1,
            select: { id: true, inventory: { select: { stock: true, reserved: true } } },
          },
        },
      },
    },
  });
  return items.map((item) => ({
    id: item.id,
    productId: item.product.id,
    slug: item.product.slug,
    name: item.product.name,
    price: item.product.price,
    compareAtPrice: item.product.compareAtPrice,
    image: item.product.images[0]?.url ?? null,
    inStock:
      (item.product.variants[0]?.inventory?.stock ?? 0) -
        (item.product.variants[0]?.inventory?.reserved ?? 0) >
      0,
    defaultVariantId: item.product.variants[0]?.id ?? null,
  }));
}

const addressSchema = z.object({
  id: zId.optional(),
  label: zOptionalString(60),
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  phone: zPhone,
  wilayaId: zId,
  communeId: zId,
  address: z.string().trim().min(5).max(300),
  isDefault: z.coerce.boolean().optional().default(false),
});

export async function getCustomerAddresses() {
  const customer = await requireCustomer();
  return prisma.address.findMany({
    where: { customerId: customer.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    include: { wilaya: { select: { name: true } }, commune: { select: { name: true } } },
  });
}

export async function saveAddressAction(input: z.infer<typeof addressSchema>) {
  const tErr = await getActionT();
  const customer = await requireCustomer();
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: tErr.addressFields };
  const data = parsed.data;
  try {
    await enforceRateLimit({ ...LIMITS.accountMutation, key: `address:${customer.id}` });
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }

  const wilaya = await prisma.wilaya.findUnique({ where: { id: data.wilayaId } });
  if (!wilaya?.isActive) return { ok: false as const, error: tErr.validWilaya };
  const commune = await prisma.commune.findFirst({
    where: { id: data.communeId, wilayaId: data.wilayaId, isActive: true },
  });
  if (!commune) return { ok: false as const, error: tErr.validCommune };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${customer.id}, 0))`;
      if (data.isDefault) {
        await tx.address.updateMany({
          where: { customerId: customer.id },
          data: { isDefault: false },
        });
      }
      if (data.id) {
        const existing = await tx.address.findFirst({
          where: { id: data.id, customerId: customer.id },
        });
        if (!existing) throw new Error(tErr.addressMissing);
        const { id: _id, ...addressData } = data;
        await tx.address.update({ where: { id: data.id }, data: addressData });
      } else {
        const count = await tx.address.count({ where: { customerId: customer.id } });
        await tx.address.create({
          data: { ...data, id: undefined, customerId: customer.id, isDefault: data.isDefault || count === 0 },
        });
      }
    });
    await recordAudit({
      actorType: "CUSTOMER",
      action: "ADDRESS_SAVED",
      resource: "Customer",
      resourceId: customer.id,
    });
    revalidatePath("/account/addresses");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function deleteAddressAction(id: string) {
  const tErr = await getActionT();
  const customer = await requireCustomer();
  const parsedId = zId.safeParse(id);
  if (!parsedId.success) return { ok: false as const, error: tErr.addressMissing };
  try {
    await enforceRateLimit({ ...LIMITS.accountMutation, key: `address:${customer.id}` });
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${customer.id}, 0))`;
      const address = await tx.address.findFirst({
        where: { id: parsedId.data, customerId: customer.id },
        select: { id: true, isDefault: true },
      });
      if (!address) throw new AppError("NOT_FOUND", tErr.addressMissing, 404);
      await tx.address.delete({ where: { id: address.id } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({
          where: { customerId: customer.id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
  revalidatePath("/account/addresses");
  return { ok: true as const };
}