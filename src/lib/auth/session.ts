import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "./tokens";

export const ADMIN_COOKIE = "nur_admin_session";
export const CUSTOMER_COOKIE = "nur_customer_session";
export const CART_COOKIE = "nur_cart";

const ADMIN_SESSION_DAYS = 7;
const CUSTOMER_SESSION_DAYS = 30;

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return {
    ip: forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : headerList.get("x-real-ip"),
    userAgent: headerList.get("user-agent"),
  };
}

// ---------------------------------------------------------------------------
// Staff / admin sessions
// ---------------------------------------------------------------------------

export async function createAdminSession(userId: string): Promise<void> {
  const token = generateToken();
  const { ip, userAgent } = await requestContext();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DAYS * 86_400_000);

  await prisma.adminSession.create({
    data: { userId, tokenHash: hashToken(token), ip, userAgent, expiresAt },
  });

  const store = await cookies();
  store.set(ADMIN_COOKIE, token, cookieOptions(expiresAt));
}

export const getAdminSession = cache(async () => {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.adminSession
    .findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    })
    .catch(() => null);

  if (!session) return null;
  if (session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.status !== "ACTIVE") return null;

  return { session, user: session.user };
});

export type AdminSessionUser = NonNullable<
  Awaited<ReturnType<typeof getAdminSession>>
>["user"];

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) {
    await prisma.adminSession
      .updateMany({
        where: { tokenHash: hashToken(token) },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  store.set(ADMIN_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}

// ---------------------------------------------------------------------------
// Customer sessions (optional accounts — guest checkout stays possible)
// ---------------------------------------------------------------------------

export async function createCustomerSession(customerId: string): Promise<void> {
  const token = generateToken();
  const { ip, userAgent } = await requestContext();
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_DAYS * 86_400_000);

  await prisma.customerSession.create({
    data: { customerId, tokenHash: hashToken(token), ip, userAgent, expiresAt },
  });

  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, cookieOptions(expiresAt));
}

export const getCustomerSession = cache(async () => {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.customerSession
    .findUnique({
      where: { tokenHash: hashToken(token) },
      include: { customer: true },
    })
    .catch(() => null);

  if (!session) return null;
  if (session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
  if (session.customer.status !== "ACTIVE") return null;

  return { session, customer: session.customer };
});

export type CustomerSessionUser = NonNullable<
  Awaited<ReturnType<typeof getCustomerSession>>
>["customer"];

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    await prisma.customerSession
      .updateMany({
        where: { tokenHash: hashToken(token) },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  store.set(CUSTOMER_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}
