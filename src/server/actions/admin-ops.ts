"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AppError, toUserMessage } from "@/lib/errors";
import { requirePermission } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { flattenZodErrors } from "@/lib/validation/common";
import {
  adminId,
  adminPage,
  adminSearch,
  auditListParams,
  customerNotes,
  customerStatus,
  deliveryCsv,
  messageStatus,
  settingsKey,
  settingsValue,
} from "@/lib/validation/admin";
import { z } from "zod";
import type { DeliveryMethod, Prisma } from "@prisma/client";

/* ---------------------------------------------------------------- Coupons */

export async function listCouponsAdmin() {
  await requirePermission("coupons:read");
  return prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
}

const couponSchema = z.object({
  id: z.string().min(1).optional(),
  code: z.string().trim().min(2).max(40),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.coerce.number().int().min(1),
  minOrder: z.coerce.number().int().min(0).nullable().optional(),
  maxDiscount: z.coerce.number().int().min(0).nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isActive: z.coerce.boolean().default(true),
  usageLimit: z.coerce.number().int().min(1).nullable().optional(),
  perCustomerLimit: z.coerce.number().int().min(1).nullable().optional(),
  firstOrderOnly: z.coerce.boolean().default(false),
  appliesToAll: z.coerce.boolean().default(true),
  productSkus: z.string().optional(),
  collectionSlugs: z.array(z.string()).default([]),
  wilayaCodes: z.array(z.coerce.number().int()).default([]),
});

export async function listCouponOptions() {
  await requirePermission("coupons:read");
  const [collections, wilayas] = await Promise.all([
    prisma.collection.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.wilaya.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    }),
  ]);
  return { collections, wilayas };
}

export async function getCouponForEdit(id: string) {
  await requirePermission("coupons:read");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) throw new AppError("INVALID_INPUT", "Invalid coupon ID.", 400);
  const coupon = await prisma.coupon.findUnique({
    where: { id: parsedId.data },
    include: {
      products: { include: { product: { select: { sku: true } } } },
      collections: { include: { collection: { select: { slug: true } } } },
      wilayas: { include: { wilaya: { select: { code: true } } } },
    },
  });
  if (!coupon) throw new AppError("NOT_FOUND", "Coupon not found.", 404);
  return {
    ...coupon,
    productSkus: coupon.products
      .map((entry) => entry.product.sku)
      .filter(Boolean)
      .join(", "),
    collectionSlugs: coupon.collections.map((entry) => entry.collection.slug),
    wilayaCodes: coupon.wilayas.map((entry) => entry.wilaya.code),
  };
}

export async function saveCouponAction(input: z.infer<typeof couponSchema>) {
  const actor = await requirePermission("coupons:write");
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please review the coupon fields.",
      fields: flattenZodErrors(parsed.error),
    };
  }
  const data = parsed.data;
  const code = data.code.trim().toUpperCase();
  if (data.startsAt && data.endsAt && new Date(data.startsAt) >= new Date(data.endsAt)) {
    return { ok: false as const, error: "The end date must be after the start date." };
  }

  if (data.type === "PERCENTAGE" && (data.value < 1 || data.value > 90)) {
    return { ok: false as const, error: "Percentage must be between 1 and 90." };
  }

  const clash = await prisma.coupon.findFirst({
    where: { code, id: data.id ? { not: data.id } : undefined },
  });
  if (clash) return { ok: false as const, error: "This code is already in use." };

  const productSkus = (data.productSkus ?? "")
    .split(",")
    .map((sku) => sku.trim())
    .filter(Boolean);
  const products =
    productSkus.length > 0
      ? await prisma.product.findMany({
          where: { sku: { in: productSkus } },
          select: { id: true, sku: true },
        })
      : [];
  const foundSkus = new Set(products.map((product) => product.sku));
  const missing = productSkus.filter((sku) => !foundSkus.has(sku));
  if (missing.length > 0) {
    return { ok: false as const, error: `Unknown product SKUs: ${missing.join(", ")}.` };
  }

  const collections =
    data.collectionSlugs.length > 0
      ? await prisma.collection.findMany({
          where: { slug: { in: data.collectionSlugs } },
          select: { id: true },
        })
      : [];
  const wilayas =
    data.wilayaCodes.length > 0
      ? await prisma.wilaya.findMany({
          where: { code: { in: data.wilayaCodes } },
          select: { id: true },
        })
      : [];
  if (
    collections.length !== new Set(data.collectionSlugs).size ||
    wilayas.length !== new Set(data.wilayaCodes).size
  ) {
    return { ok: false as const, error: "One or more coupon targets do not exist." };
  }
  if (
    !data.appliesToAll &&
    products.length === 0 &&
    collections.length === 0 &&
    wilayas.length === 0
  ) {
    return {
      ok: false as const,
      error: "Choose at least one target or explicitly enable whole-store scope.",
    };
  }

  const payload = {
    code,
    type: data.type,
    value: data.value,
    minOrder: data.minOrder ?? null,
    maxDiscount: data.maxDiscount ?? null,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
    isActive: data.isActive,
    usageLimit: data.usageLimit ?? null,
    perCustomerLimit: data.perCustomerLimit ?? null,
    firstOrderOnly: data.firstOrderOnly,
    appliesToAll: data.appliesToAll,
  };

  try {
    await prisma.$transaction(async (tx) => {
      const coupon = data.id
        ? await tx.coupon.update({ where: { id: data.id }, data: payload })
        : await tx.coupon.create({ data: payload });

      await tx.couponProduct.deleteMany({ where: { couponId: coupon.id } });
      await tx.couponCollection.deleteMany({ where: { couponId: coupon.id } });
      await tx.couponWilaya.deleteMany({ where: { couponId: coupon.id } });

      if (products.length > 0) {
        await tx.couponProduct.createMany({
          data: products.map((product) => ({ couponId: coupon.id, productId: product.id })),
        });
      }
      if (collections.length > 0) {
        await tx.couponCollection.createMany({
          data: collections.map((collection) => ({
            couponId: coupon.id,
            collectionId: collection.id,
          })),
        });
      }
      if (wilayas.length > 0) {
        await tx.couponWilaya.createMany({
          data: wilayas.map((wilaya) => ({ couponId: coupon.id, wilayaId: wilaya.id })),
        });
      }
    });
    await recordAudit({
      actorUserId: actor.id,
      action: data.id ? "COUPON_UPDATED" : "COUPON_CREATED",
      resource: "Coupon",
      resourceId: code,
    });
    revalidatePath("/admin/coupons");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function deleteCouponAction(id: string) {
  const actor = await requirePermission("coupons:write");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) return { ok: false as const, error: "Invalid coupon ID." };
  try {
    const redemptions = await prisma.couponRedemption.count({ where: { couponId: parsedId.data } });
    if (redemptions > 0) {
      await prisma.coupon.update({ where: { id: parsedId.data }, data: { isActive: false } });
    } else {
      await prisma.coupon.delete({ where: { id: parsedId.data } });
    }
  } catch {
    return { ok: false as const, error: "Coupon not found or already changed." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "COUPON_DELETED",
    resource: "Coupon",
    resourceId: parsedId.data,
  });
  revalidatePath("/admin/coupons");
  return { ok: true as const };
}

/* --------------------------------------------------------------- Delivery */

export async function listDeliveryRates() {
  await requirePermission("delivery:read");
  return prisma.wilaya.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      stopdeskAvailable: true,
      deliveryRates: { orderBy: { method: "asc" } },
    },
  });
}

const rateSchema = z.object({
  wilayaId: adminId,
  method: z.enum(["HOME", "STOPDESK", "EXPRESS", "STANDARD"]),
  price: z.coerce.number().int().min(0),
  etaMinDays: z.coerce.number().int().min(0).max(30),
  etaMaxDays: z.coerce.number().int().min(0).max(30),
  isActive: z.coerce.boolean().default(true),
});

export async function saveDeliveryRateAction(input: z.infer<typeof rateSchema>) {
  const actor = await requirePermission("delivery:write");
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success || parsed.data.etaMaxDays < parsed.data.etaMinDays) {
    return { ok: false as const, error: "Please review the delivery rate fields." };
  }
  const data = parsed.data;
  const wilaya = await prisma.wilaya.findUnique({
    where: { id: data.wilayaId },
    select: { id: true },
  });
  if (!wilaya) return { ok: false as const, error: "Wilaya not found." };
  try {
    await prisma.deliveryRate.upsert({
      where: { wilayaId_method: { wilayaId: data.wilayaId, method: data.method as DeliveryMethod } },
      create: {
        wilayaId: data.wilayaId,
        method: data.method as DeliveryMethod,
        price: data.price,
        etaMinDays: data.etaMinDays,
        etaMaxDays: data.etaMaxDays,
        isActive: data.isActive,
      },
      update: {
        price: data.price,
        etaMinDays: data.etaMinDays,
        etaMaxDays: data.etaMaxDays,
        isActive: data.isActive,
      },
    });
  } catch {
    return { ok: false as const, error: "Could not save this delivery rate." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "DELIVERY_RATE_UPDATED",
    resource: "DeliveryRate",
    resourceId: data.wilayaId,
    metadata: { method: data.method, price: data.price },
  });
  revalidatePath("/admin/delivery");
  return { ok: true as const };
}

export async function importDeliveryCsvAction(csv: string) {
  const actor = await requirePermission("delivery:write");
  const parsedCsv = deliveryCsv.safeParse(csv);
  if (!parsedCsv.success || Buffer.byteLength(parsedCsv.data, "utf8") > 1_000_000)
    return { ok: false as const, error: "CSV is too large." };
  csv = parsedCsv.data;
  // Columns: wilaya_code,method,price,eta_min,eta_max,active
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const start = lines[0]?.toLowerCase().includes("wilaya") ? 1 : 0;
  let updated = 0;
  const errors: string[] = [];

  const wilayas = await prisma.wilaya.findMany({ select: { id: true, code: true } });
  const byCode = new Map(wilayas.map((wilaya) => [wilaya.code, wilaya.id]));
  const methods = ["HOME", "STOPDESK", "EXPRESS", "STANDARD"];

  if (lines.length - start > 2000)
    return { ok: false as const, error: "CSV contains too many rows." };
  const updates: Array<{
    wilayaId: string;
    method: DeliveryMethod;
    price: number;
    etaMin: number;
    etaMax: number;
    active: boolean;
  }> = [];
  for (let index = start; index < lines.length; index += 1) {
    const parts = (lines[index] ?? "").split(",").map((part) => part.trim());
    const [codeRaw, methodRaw, priceRaw, etaMinRaw, etaMaxRaw, activeRaw] = parts;
    const code = Number(codeRaw);
    const method = (methodRaw ?? "").toUpperCase();
    const wilayaId = byCode.get(code);
    if (!wilayaId || !methods.includes(method)) {
      errors.push(`Line ${index + 1}: unknown wilaya or method.`);
      continue;
    }
    const price = Number(priceRaw);
    const etaMin = Number(etaMinRaw ?? 1);
    const etaMax = Number(etaMaxRaw ?? 3);
    if (
      parts.length !== 6 ||
      !Number.isInteger(price) ||
      price < 0 ||
      !Number.isInteger(etaMin) ||
      !Number.isInteger(etaMax) ||
      etaMin < 0 ||
      etaMax > 30 ||
      etaMax < etaMin ||
      !["0", "1"].includes(activeRaw ?? "1")
    ) {
      errors.push(`Line ${index + 1}: invalid numbers.`);
      continue;
    }
    updates.push({
      wilayaId,
      method: method as DeliveryMethod,
      price,
      etaMin,
      etaMax,
      active: activeRaw !== "0",
    });
  }
  if (errors.length > 0) return { ok: false as const, error: errors.slice(0, 10).join(" ") };
  await prisma.$transaction(async (tx) => {
    for (const item of updates)
      await tx.deliveryRate.upsert({
        where: { wilayaId_method: { wilayaId: item.wilayaId, method: item.method } },
        create: {
          wilayaId: item.wilayaId,
          method: item.method,
          price: item.price,
          etaMinDays: item.etaMin,
          etaMaxDays: item.etaMax,
          isActive: item.active,
        },
        update: {
          price: item.price,
          etaMinDays: item.etaMin,
          etaMaxDays: item.etaMax,
          isActive: item.active,
        },
      });
  });
  updated = updates.length;

  await recordAudit({
    actorUserId: actor.id,
    action: "DELIVERY_RATES_IMPORTED",
    resource: "DeliveryRate",
    metadata: { updated },
  });
  revalidatePath("/admin/delivery");
  return { ok: true as const, updated, errors: errors.slice(0, 10) };
}

/* --------------------------------------------------------------- Customers */

export async function listCustomersAdmin(params: { search?: string; page?: number }) {
  await requirePermission("customers:read");
  const parsed = z
    .object({ search: adminSearch, page: adminPage })
    .safeParse(params);
  if (!parsed.success) return { items: [], total: 0, page: 1, totalPages: 1 };
  const page = parsed.data.page;
  const pageSize = 20;
  const where: Prisma.CustomerWhereInput = {};
  if (parsed.data.search) {
    const term = parsed.data.search.trim();
    where.OR = [
      { phone: { contains: term } },
      { email: { contains: term, mode: "insensitive" } },
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { lastOrderAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        status: true,
        riskLevel: true,
        lastOrderAt: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getCustomerDetail(id: string) {
  const actor = await requirePermission("customers:read");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) throw new AppError("INVALID_INPUT", "Invalid customer ID.", 400);
  const customer = await prisma.customer.findUnique({
    where: { id: parsedId.data },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      riskLevel: true,
      riskNotes: true,
      lastOrderAt: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
      },
      addresses: {
        include: { wilaya: { select: { name: true } }, commune: { select: { name: true } } },
      },
    },
  });
  if (!customer) throw new AppError("NOT_FOUND", "Customer not found.", 404);
  await recordAudit({
    actorUserId: actor.id,
    action: "CUSTOMER_DETAIL_VIEWED",
    resource: "Customer",
    resourceId: id,
  });
  return customer;
}

export async function setCustomerStatusAction(id: string, status: "ACTIVE" | "BLOCKED") {
  const actor = await requirePermission("customers:write");
  const parsedId = adminId.safeParse(id);
  const parsedStatus = customerStatus.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return { ok: false as const, error: "Invalid customer status update." };
  try {
    await prisma.customer.update({ where: { id: parsedId.data }, data: { status: parsedStatus.data } });
    await prisma.customerSession.updateMany({
      where: { customerId: parsedId.data },
      data: { revokedAt: new Date() },
    });
  } catch {
    return { ok: false as const, error: "Customer not found or already changed." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "CUSTOMER_STATUS_CHANGED",
    resource: "Customer",
    resourceId: parsedId.data,
    metadata: { status: parsedStatus.data },
  });
  revalidatePath("/admin/customers");
  return { ok: true as const };
}

export async function updateCustomerNotesAction(id: string, notes: string) {
  const actor = await requirePermission("customers:write");
  const parsed = z.object({ id: adminId, notes: customerNotes }).safeParse({ id, notes });
  if (!parsed.success) return { ok: false as const, error: "Invalid customer notes." };
  try {
    await prisma.customer.update({
      where: { id: parsed.data.id },
      data: { riskNotes: parsed.data.notes.trim() || null },
    });
  } catch {
    return { ok: false as const, error: "Customer not found or already changed." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "CUSTOMER_NOTES_UPDATED",
    resource: "Customer",
    resourceId: parsed.data.id,
  });
  revalidatePath(`/admin/customers/${parsed.data.id}`);
  return { ok: true as const };
}

/* -------------------------------------------------------------- Newsletter */

export async function listSubscribersAdmin() {
  await requirePermission("newsletter:read");
  return prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, email: true, createdAt: true, unsubscribedAt: true, source: true },
  });
}

export async function deleteSubscriberAction(id: string) {
  const actor = await requirePermission("newsletter:write");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) return { ok: false as const, error: "Invalid subscriber ID." };
  try {
    await prisma.newsletterSubscriber.delete({ where: { id: parsedId.data } });
  } catch {
    return { ok: false as const, error: "Subscriber not found or already changed." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "NEWSLETTER_SUBSCRIBER_DELETED",
    resource: "NewsletterSubscriber",
    resourceId: parsedId.data,
  });
  revalidatePath("/admin/newsletter");
  return { ok: true as const };
}

/* ---------------------------------------------------------------- Messages */

export async function listMessagesAdmin(status?: string) {
  await requirePermission("messages:read");
  const parsedStatus = status ? messageStatus.safeParse(status) : null;
  if (parsedStatus && !parsedStatus.success) return [];
  return prisma.contactMessage.findMany({
    where: parsedStatus?.success ? { status: parsedStatus.data } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function setMessageStatusAction(
  id: string,
  status: "NEW" | "IN_PROGRESS" | "RESOLVED" | "SPAM",
) {
  const actor = await requirePermission("messages:write");
  const parsedId = adminId.safeParse(id);
  const parsedStatus = messageStatus.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return { ok: false as const, error: "Invalid message status update." };
  try {
    await prisma.contactMessage.update({
      where: { id: parsedId.data },
      data: { status: parsedStatus.data },
    });
  } catch {
    return { ok: false as const, error: "Message not found or already changed." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "MESSAGE_STATUS_CHANGED",
    resource: "ContactMessage",
    resourceId: parsedId.data,
    metadata: { status: parsedStatus.data },
  });
  revalidatePath("/admin/messages");
  return { ok: true as const };
}

/* ----------------------------------------------------------------- Content */

const pageSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(100_000).default(""),
  isPublished: z.coerce.boolean().default(true),
  seoTitle: z.string().trim().max(160).optional(),
  seoDescription: z.string().trim().max(320).optional(),
});

export async function listPagesAdmin() {
  await requirePermission("content:write");
  return prisma.page.findMany({ orderBy: { slug: "asc" } });
}

export async function savePageAction(input: z.infer<typeof pageSchema>) {
  const actor = await requirePermission("content:write");
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please review the page fields.",
      fields: flattenZodErrors(parsed.error),
    };
  }
  const data = parsed.data;
  const { cleanRichText: clean } = await import("@/lib/sanitize");
  const content = clean(data.content);
  const saved = data.id
    ? await prisma.page.update({
        where: { id: data.id },
        data: {
          slug: data.slug,
          title: data.title,
          content,
          isPublished: data.isPublished,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
        },
      })
    : await prisma.page.create({
        data: {
          slug: data.slug,
          title: data.title,
          content,
          isPublished: data.isPublished,
          seoTitle: data.seoTitle || null,
          seoDescription: data.seoDescription || null,
        },
      });
  await recordAudit({
    actorUserId: actor.id,
    action: data.id ? "PAGE_UPDATED" : "PAGE_CREATED",
    resource: "Page",
    resourceId: saved.id,
  });
  revalidatePath("/admin/content");
  revalidatePath(`/pages/${saved.slug}`);
  return { ok: true as const };
}

const faqSchema = z.object({
  id: z.string().min(1).optional(),
  category: z.string().trim().min(1).max(80),
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(4000),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isPublished: z.coerce.boolean().default(true),
});

export async function listFaqAdmin() {
  await requirePermission("content:write");
  return prisma.faqItem.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
}

export async function saveFaqAction(input: z.infer<typeof faqSchema>) {
  const actor = await requirePermission("content:write");
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please review the FAQ fields." };
  const data = parsed.data;
  const { id: _faqId, ...faqData } = data;
  const saved = data.id
    ? await prisma.faqItem.update({ where: { id: data.id }, data: faqData })
    : await prisma.faqItem.create({ data: faqData });
  await recordAudit({
    actorUserId: actor.id,
    action: data.id ? "FAQ_UPDATED" : "FAQ_CREATED",
    resource: "FaqItem",
    resourceId: saved.id,
  });
  revalidatePath("/admin/content");
  revalidatePath("/faq");
  return { ok: true as const };
}

export async function deleteFaqAction(id: string) {
  const actor = await requirePermission("content:write");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) return { ok: false as const, error: "Invalid FAQ ID." };
  try {
    await prisma.faqItem.delete({ where: { id: parsedId.data } });
  } catch {
    return { ok: false as const, error: "FAQ not found or already changed." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "FAQ_DELETED",
    resource: "FaqItem",
    resourceId: parsedId.data,
  });
  revalidatePath("/admin/content");
  return { ok: true as const };
}

const announcementSchema = z.object({
  id: z.string().min(1).optional(),
  text: z.string().trim().min(1).max(200),
  href: z.string().trim().max(300).optional(),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function listAnnouncementsAdmin() {
  await requirePermission("content:write");
  return prisma.announcement.findMany({ orderBy: [{ sortOrder: "asc" }] });
}

export async function saveAnnouncementAction(input: z.infer<typeof announcementSchema>) {
  const actor = await requirePermission("content:write");
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Please review the announcement." };
  const data = parsed.data;
  if (data.href) {
    if (data.href.startsWith("//") || /^(javascript|data|vbscript):/i.test(data.href)) {
      return { ok: false as const, error: "Please provide a safe announcement link." };
    }
    if (data.href.startsWith("http://"))
      return { ok: false as const, error: "Announcement links must use HTTPS." };
    if (data.href.startsWith("https://")) {
      try {
        new URL(data.href);
      } catch {
        return { ok: false as const, error: "Please provide a valid announcement link." };
      }
    } else if (!data.href.startsWith("/")) {
      return {
        ok: false as const,
        error: "Announcement links must be relative paths or HTTPS URLs.",
      };
    }
  }
  const { id: _announcementId, ...announcementData } = data;
  const saved = data.id
    ? await prisma.announcement.update({
        where: { id: data.id },
        data: { ...announcementData, href: data.href || null },
      })
    : await prisma.announcement.create({ data: { ...announcementData, href: data.href || null } });
  await recordAudit({
    actorUserId: actor.id,
    action: data.id ? "ANNOUNCEMENT_UPDATED" : "ANNOUNCEMENT_CREATED",
    resource: "Announcement",
    resourceId: saved.id,
  });
  revalidatePath("/admin/content");
  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteAnnouncementAction(id: string) {
  const actor = await requirePermission("content:write");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) return { ok: false as const, error: "Invalid announcement ID." };
  try {
    await prisma.announcement.delete({ where: { id: parsedId.data } });
  } catch {
    return { ok: false as const, error: "Announcement not found or already changed." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "ANNOUNCEMENT_DELETED",
    resource: "Announcement",
    resourceId: parsedId.data,
  });
  revalidatePath("/admin/content");
  return { ok: true as const };
}

/* ---------------------------------------------------------------- Settings */

export async function saveSettingsAction(key: string, value: unknown) {
  const actor = await requirePermission("settings:write");
  const { DEFAULT_SETTINGS, updateSettingsSection } = await import("@/lib/settings");
  const parsed = z.object({ key: settingsKey, value: settingsValue }).safeParse({ key, value });
  if (!parsed.success || !Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, parsed.data.key)) {
    return { ok: false as const, error: "Invalid settings value." };
  }
  const section = parsed.data.key as keyof typeof DEFAULT_SETTINGS;
  await updateSettingsSection(section, parsed.data.value as never);
  await recordAudit({
    actorUserId: actor.id,
    action: "SETTINGS_UPDATED",
    resource: "Setting",
    resourceId: parsed.data.key,
  });
  revalidatePath("/");
  revalidatePath("/admin/settings");
  return { ok: true as const };
}

/* -------------------------------------------------------------- Promotions */

export async function listPromotionsAdmin() {
  await requirePermission("promotions:read");
  return prisma.promotion.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      collection: { select: { name: true } },
      _count: { select: { products: true, orders: true } },
    },
  });
}

const promotionSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.coerce.number().int().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  isActive: z.coerce.boolean().default(true),
  collectionSlug: z.string().trim().optional(),
  productSkus: z.string().optional(),
});

export async function savePromotionAction(input: z.infer<typeof promotionSchema>) {
  const actor = await requirePermission("promotions:write");
  const parsed = promotionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: "Please review the promotion fields.",
      fields: flattenZodErrors(parsed.error),
    };
  }
  const data = parsed.data;

  if (data.type === "PERCENTAGE" && (data.value < 1 || data.value > 90)) {
    return { ok: false as const, error: "Percentage must be between 1 and 90." };
  }
  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(data.endsAt);
  if (!(startsAt < endsAt)) {
    return { ok: false as const, error: "The end date must be after the start date." };
  }

  const productSkus = (data.productSkus ?? "")
    .split(",")
    .map((sku) => sku.trim())
    .filter(Boolean);
  const products =
    productSkus.length > 0
      ? await prisma.product.findMany({
          where: { sku: { in: productSkus } },
          select: { id: true, sku: true },
        })
      : [];
  const found = new Set(products.map((product) => product.sku));
  const missing = productSkus.filter((sku) => !found.has(sku));
  if (missing.length > 0) {
    return { ok: false as const, error: `Unknown product SKUs: ${missing.join(", ")}.` };
  }

  let collectionId: string | null = null;
  let preserveExistingScope = false;
  if (data.id && !data.collectionSlug && productSkus.length === 0) {
    const existing = await prisma.promotion.findUnique({
      where: { id: data.id },
      select: { collectionId: true },
    });
    if (!existing) return { ok: false as const, error: "Promotion not found." };
    collectionId = existing.collectionId;
    preserveExistingScope = true;
  }
  if (data.collectionSlug) {
    const collection = await prisma.collection.findUnique({ where: { slug: data.collectionSlug } });
    if (!collection) return { ok: false as const, error: "Unknown collection slug." };
    collectionId = collection.id;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const promotion = data.id
        ? await tx.promotion.update({
            where: { id: data.id },
            data: {
              name: data.name,
              type: data.type,
              value: data.value,
              startsAt,
              endsAt,
              isActive: data.isActive,
              collectionId,
            },
          })
        : await tx.promotion.create({
            data: {
              name: data.name,
              type: data.type,
              value: data.value,
              startsAt,
              endsAt,
              isActive: data.isActive,
              collectionId,
            },
          });
      if (!preserveExistingScope)
        await tx.promotionProduct.deleteMany({ where: { promotionId: promotion.id } });
      if (!preserveExistingScope && products.length > 0) {
        await tx.promotionProduct.createMany({
          data: products.map((product) => ({ promotionId: promotion.id, productId: product.id })),
        });
      }
    });
    await recordAudit({
      actorUserId: actor.id,
      action: data.id ? "PROMOTION_UPDATED" : "PROMOTION_CREATED",
      resource: "Promotion",
      resourceId: data.id ?? data.name,
    });
    revalidatePath("/admin/promotions");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: toUserMessage(error) };
  }
}

export async function deletePromotionAction(id: string) {
  const actor = await requirePermission("promotions:write");
  const parsedId = adminId.safeParse(id);
  if (!parsedId.success) return { ok: false as const, error: "Invalid promotion ID." };
  try {
    const orders = await prisma.order.count({ where: { promotionId: parsedId.data } });
    if (orders > 0) {
      await prisma.promotion.update({ where: { id: parsedId.data }, data: { isActive: false } });
    } else {
      await prisma.promotion.delete({ where: { id: parsedId.data } });
    }
  } catch {
    return { ok: false as const, error: "Promotion not found or already changed." };
  }
  await recordAudit({
    actorUserId: actor.id,
    action: "PROMOTION_DELETED",
    resource: "Promotion",
    resourceId: parsedId.data,
  });
  revalidatePath("/admin/promotions");
  return { ok: true as const };
}

/* ------------------------------------------------------------------ Audit */

export async function listAuditLogs(params: { action?: string; search?: string; page?: number }) {
  await requirePermission("audit:read");
  const parsed = auditListParams.safeParse(params);
  if (!parsed.success) return { items: [], total: 0, page: 1, totalPages: 1 };
  const safeParams = parsed.data;
  const page = safeParams.page;
  const pageSize = 30;
  const where: Prisma.AuditLogWhereInput = {};
  if (safeParams.action) where.action = safeParams.action;
  if (safeParams.search) {
    where.OR = [
      { resourceId: { contains: safeParams.search } },
      { action: { contains: safeParams.search, mode: "insensitive" } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        actorType: true,
        action: true,
        resource: true,
        resourceId: true,
        ip: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
