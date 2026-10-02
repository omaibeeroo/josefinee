"use server";

import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { newsletterSchema, contactSchema } from "@/lib/validation/auth";
import { reviewSchema } from "@/lib/validation/auth";
import { z } from "zod";
import {
  createCustomerSession,
  destroyCustomerSession,
  getCustomerSession,
  CART_COOKIE,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword, passwordIssues } from "@/lib/auth/password";
import { attachCartToCustomer } from "@/server/cart";
import { enforceRateLimit, LIMITS, clientIp } from "@/lib/rate-limit";
import { customerLoginSchema, customerRegisterSchema } from "@/lib/validation/auth";
import { flattenZodErrors, isBotSubmission } from "@/lib/validation/common";
import { recordAudit } from "@/lib/audit";
import { storefrontProductWhere } from "@/server/catalog";
import { Prisma } from "@prisma/client";

export async function subscribeNewsletterAction(email: string, source?: string, website?: string) {
  const parsed = newsletterSchema.safeParse({ email, source, website });
  if (!parsed.success) {
    return { ok: false as const, error: "Please enter a valid email address." };
  }
  if (isBotSubmission(parsed.data.website)) {
    // Pretend success so bots learn nothing.
    return { ok: true as const, message: "Thank you for subscribing." };
  }

  const ip = await clientIp();
  try {
    await enforceRateLimit({ ...LIMITS.newsletter, key: `newsletter:${ip}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      if (existing.unsubscribedAt) {
        await prisma.newsletterSubscriber.update({
          where: { id: existing.id },
          data: { unsubscribedAt: null, consentAt: new Date(), source: source ?? null },
        });
        return { ok: true as const, message: "Welcome back — you are subscribed." };
      }
      return { ok: true as const, message: "You are already subscribed." };
    }
    await prisma.newsletterSubscriber.create({
      data: { email: parsed.data.email, ip, source: source ?? null },
    });
    return { ok: true as const, message: "Thank you for subscribing." };
  } catch (error) {
    console.error("[newsletter] failed", error);
    return { ok: false as const, error: "Something went wrong. Please try again." };
  }
}

export async function unsubscribeAction(token: string) {
  const parsedToken = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/).safeParse(token);
  if (!parsedToken.success) return { ok: false as const, error: "This link is not valid." };
  const ip = await clientIp();
  try {
    await enforceRateLimit({ ...LIMITS.lookup, key: `unsubscribe:${ip}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }
  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { unsubscribeToken: parsedToken.data },
  });
  if (!subscriber) return { ok: false as const, error: "This link is not valid." };
  await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { unsubscribedAt: new Date() },
  });
  return { ok: true as const };
}

export async function submitContactAction(input: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  website?: string;
}) {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Please review the highlighted fields." };
  }
  if (isBotSubmission(parsed.data.website)) {
    return { ok: true as const, message: "Thank you — we will get back to you soon." };
  }
  const ip = await clientIp();
  try {
    await enforceRateLimit({ ...LIMITS.contact, key: `contact:${ip}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }
  try {
    const { website: _website, ...message } = parsed.data;
    void _website;
    await prisma.contactMessage.create({ data: { ...message, ip } });
    return { ok: true as const, message: "Thank you — we will get back to you soon." };
  } catch (error) {
    console.error("[contact] failed", error);
    return { ok: false as const, error: "Something went wrong. Please try again." };
  }
}

export async function submitReviewAction(input: {
  productId: string;
  rating: number;
  title?: string;
  body: string;
  authorName: string;
  website?: string;
}) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Please complete the review form." };
  }
  if (isBotSubmission(parsed.data.website)) {
    return { ok: true as const, message: "Thank you — your review is awaiting moderation." };
  }
  const session = await getCustomerSession();
  const ip = await clientIp();
  const guestIdentityHash = !session?.customer
    ? createHmac("sha256", process.env.AUTH_SECRET ?? "review-identity-fallback").update(ip).digest("hex")
    : null;

  try {
    await enforceRateLimit({ ...LIMITS.review, key: `review-ip:${ip}` });
    await enforceRateLimit({ ...LIMITS.review, key: `review-ip-product:${ip}:${parsed.data.productId}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }

  // One review per customer per product; guests are limited to one per hashed IP.
  const existing = session?.customer
    ? await prisma.review.findUnique({
        where: { productId_customerId: { productId: parsed.data.productId, customerId: session.customer.id } },
      })
    : await prisma.review.findFirst({
        where: { productId: parsed.data.productId, guestIdentityHash },
      });

  if (existing) {
    return { ok: false as const, error: "You have already reviewed this product." };
  }

  try {
    await prisma.review.create({
      data: {
        productId: parsed.data.productId,
        customerId: session?.customer.id ?? null,
        guestIdentityHash,
        authorName: parsed.data.authorName,
        rating: parsed.data.rating,
        title: parsed.data.title,
        body: parsed.data.body,
        status: "PENDING",
      },
    });
    return { ok: true as const, message: "Thank you — your review is awaiting moderation." };
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return { ok: false as const, error: "You have already reviewed this product." };
    }
    console.error("[review] submission failed", error instanceof Error ? error.name : "unknown");
    return { ok: false as const, error: "Something went wrong. Please try again." };
  }
}

export async function toggleWishlistAction(productId: string) {
  const parsedId = z.string().min(1).max(64).safeParse(productId);
  if (!parsedId.success) return { ok: false as const, error: "This product is not available." };
  const session = await getCustomerSession();
  if (!session) {
    return { ok: false as const, code: "NEED_LOGIN" as const, error: "Sign in to sync your wishlist." };
  }
  try {
    await enforceRateLimit({ ...LIMITS.wishlist, key: `wishlist:${session.customer.id}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }

  const visibleProduct = await prisma.product.findFirst({
    where: { AND: [storefrontProductWhere(), { id: parsedId.data }] },
    select: { id: true },
  });
  if (!visibleProduct) return { ok: false as const, error: "This product is not available." };

  let wishlist = await prisma.wishlist.findUnique({
    where: { customerId: session.customer.id },
  });
  if (!wishlist) {
    wishlist = await prisma.wishlist.create({ data: { customerId: session.customer.id } });
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: { wishlistId_productId: { wishlistId: wishlist.id, productId: parsedId.data } },
  });
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return { ok: true as const, saved: false };
  }
  await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId: parsedId.data } });
  return { ok: true as const, saved: true };
}

/** IDs saved in the server wishlist (empty when logged out). */
export async function getWishlistIdsAction(): Promise<{ ids: string[]; loggedIn: boolean }> {
  const session = await getCustomerSession();
  if (!session) return { ids: [], loggedIn: false };
  const wishlist = await prisma.wishlist.findUnique({
    where: { customerId: session.customer.id },
    include: { items: { select: { productId: true } } },
  });
  return { ids: wishlist?.items.map((item) => item.productId) ?? [], loggedIn: true };
}

/** Merges guest (localStorage) wishlist ids into the account after login. */
export async function mergeWishlistAction(productIds: string[]) {
  const session = await getCustomerSession();
  if (!session) return { ok: false as const, error: "Please sign in." };
  const parsedIds = z.array(z.string().min(1).max(64)).max(100).safeParse(productIds);
  if (!parsedIds.success) return { ok: false as const, error: "The wishlist could not be updated." };
  try {
    await enforceRateLimit({ ...LIMITS.wishlist, key: `wishlist:${session.customer.id}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }
  const ids = [...new Set(parsedIds.data)];
  if (ids.length === 0) return { ok: true as const, added: 0 };

  const products = await prisma.product.findMany({
    where: { AND: [storefrontProductWhere(), { id: { in: ids } }] },
    select: { id: true },
  });
  const valid = new Set(products.map((product) => product.id));

  let wishlist = await prisma.wishlist.findUnique({ where: { customerId: session.customer.id } });
  if (!wishlist) {
    wishlist = await prisma.wishlist.create({ data: { customerId: session.customer.id } });
  }
  const existing = await prisma.wishlistItem.findMany({
    where: { wishlistId: wishlist.id },
    select: { productId: true },
  });
  const existingIds = new Set(existing.map((item) => item.productId));
  const toAdd = [...valid].filter((id) => !existingIds.has(id));
  if (toAdd.length > 0) {
    await prisma.wishlistItem.createMany({
      data: toAdd.map((productId) => ({ wishlistId: wishlist!.id, productId })),
      skipDuplicates: true,
    });
  }
  return { ok: true as const, added: toAdd.length };
}

/** Public product data for rendering a guest (localStorage) wishlist. */
export async function getWishlistProductsAction(productIds: string[]) {
  const parsedIds = z.array(z.string().min(1).max(64)).max(100).safeParse(productIds);
  if (!parsedIds.success) return [];
  const ids = [...new Set(parsedIds.data)];
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { AND: [storefrontProductWhere(), { id: { in: ids } }] },
    include: {
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        take: 1,
        include: { inventory: true },
      },
    },
  });
  return products.map((product) => ({
    id: product.id,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    image: product.images[0]?.url ?? null,
    inStock:
      (product.variants[0]?.inventory?.stock ?? 0) - (product.variants[0]?.inventory?.reserved ?? 0) > 0,
    defaultVariantId: product.variants[0]?.id ?? null,
  }));
}

export async function registerAction(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}) {
  const parsed = customerRegisterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Please review the highlighted fields.", fields: flattenZodErrors(parsed.error) };
  }

  const ip = await clientIp();
  try {
    await enforceRateLimit({ ...LIMITS.register, key: `register:${ip}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }

  const existing = await prisma.customer.findFirst({
    where: { OR: [{ email: parsed.data.email }, { phone: parsed.data.phone }] },
  });
  if (existing) {
    return { ok: false as const, error: "An account already exists with this email or phone." };
  }

  let customer;
  try {
    customer = await prisma.customer.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        passwordHash: await hashPassword(parsed.data.password),
        marketingConsent: false,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false as const, error: "An account already exists with this email or phone." };
    }
    console.error("[register] failed", error instanceof Error ? error.name : "unknown");
    return { ok: false as const, error: "Something went wrong. Please try again." };
  }

  await createCustomerSession(customer.id);
  await attachCartToCustomer(customer.id);
  return { ok: true as const };
}

export async function loginAction(input: { email: string; password: string }) {
  const parsed = customerLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Please enter your email and password." };
  }

  const ip = await clientIp();
  try {
    await enforceRateLimit({ ...LIMITS.login, key: `login:${ip}` });
    await enforceRateLimit({ ...LIMITS.login, key: `login-account:${parsed.data.email}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }

  const customer = await prisma.customer.findUnique({ where: { email: parsed.data.email } });
  if (!customer?.passwordHash || customer.status !== "ACTIVE") {
    return { ok: false as const, error: "Email or password is incorrect." };
  }
  const valid = await verifyPassword(customer.passwordHash, parsed.data.password);
  if (!valid) {
    return { ok: false as const, error: "Email or password is incorrect." };
  }

  await createCustomerSession(customer.id);
  await attachCartToCustomer(customer.id);
  return { ok: true as const };
}

export async function logoutAction() {
  await destroyCustomerSession();
  redirect("/");
}

const passwordChangeSchema = z
  .object({
    current: z.string().min(1),
    next: z.string().min(10).max(200),
  })
  .refine((data) => passwordIssues(data.next).length === 0, {
    message: "Use upper and lower case letters and at least one number.",
    path: ["next"],
  });

export async function changePasswordAction(input: { current: string; next: string }) {
  const session = await getCustomerSession();
  if (!session) return { ok: false as const, error: "Please sign in." };
  try {
    await enforceRateLimit({ ...LIMITS.passwordReset, key: `password-change:${session.customer.id}` });
  } catch {
    return { ok: false as const, error: "Too many attempts. Please try again later." };
  }

  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Please choose a stronger password." };
  }

  if (!session.customer.passwordHash) {
    return { ok: false as const, error: "No password is set on this account." };
  }

  const valid = await verifyPassword(session.customer.passwordHash, parsed.data.current);
  if (!valid) return { ok: false as const, error: "Your current password is incorrect." };

  await prisma.customer.update({
    where: { id: session.customer.id },
    data: { passwordHash: await hashPassword(parsed.data.next) },
  });
  await recordAudit({
    actorType: "CUSTOMER",
    action: "PASSWORD_CHANGED",
    resource: "Customer",
    resourceId: session.customer.id,
  });
  return { ok: true as const, message: "Your password has been updated." };
}

export async function clearCartCookieAction() {
  const store = await cookies();
  store.delete(CART_COOKIE);
}
