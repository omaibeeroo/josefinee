import "server-only";
import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { CACHE_TAG_DELIVERY, CATALOG_REVALIDATE_SECONDS } from "@/lib/cache";
import type { DeliveryMethod } from "@prisma/client";

type DbClient = typeof prisma | Prisma.TransactionClient;

export type WilayaOption = {
  id: string;
  code: number;
  name: string;
  nameAr: string | null;
  stopdeskAvailable: boolean;
};

export type CommuneOption = { id: string; name: string };

export type DeliveryOption = {
  method: DeliveryMethod;
  price: number;
  etaMinDays: number;
  etaMaxDays: number;
};

/**
 * Reference data (wilayas, communes, per-wilaya rates) is display-only here:
 * checkout recomputes the concrete rate live via resolveDeliveryRate inside
 * the order transaction, so a stale cache can never misprice an order. All
 * three getters share the delivery tag; every admin mutation that touches
 * rates or active flags revalidates it next to its path revalidation.
 */
const getActiveWilayasCached = unstable_cache(
  async () =>
    prisma.wilaya.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, nameAr: true, stopdeskAvailable: true },
    }),
  ["delivery:wilayas"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_DELIVERY] },
);

export async function getActiveWilayas(): Promise<WilayaOption[]> {
  return getActiveWilayasCached();
}

const getCommunesCached = unstable_cache(
  async (wilayaId: string) =>
    prisma.commune.findMany({
      where: { wilayaId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ["delivery:communes"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_DELIVERY] },
);

export async function getCommunes(wilayaId: string): Promise<CommuneOption[]> {
  if (!wilayaId) return [];
  return getCommunesCached(wilayaId);
}

const getDeliveryOptionsCached = unstable_cache(
  async (wilayaId: string): Promise<DeliveryOption[]> => {
    const rates = await prisma.deliveryRate.findMany({
      where: { wilayaId, isActive: true },
      orderBy: { price: "asc" },
    });
    // Labels are localized client-side via t.delivery[method]; the server
    // never ships display copy (keeps payloads small and unilingual-free).
    return rates.map((rate) => ({
      method: rate.method,
      price: rate.price,
      etaMinDays: rate.etaMinDays,
      etaMaxDays: rate.etaMaxDays,
    }));
  },
  ["delivery:options"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_DELIVERY] },
);

export async function getDeliveryOptions(wilayaId: string): Promise<DeliveryOption[]> {
  if (!wilayaId) return [];
  return getDeliveryOptionsCached(wilayaId);
}

/**
 * Lowest active HOME rate nationwide — an honest "delivery from" estimate.
 * Display-only: checkout always resolves the concrete rate live. Cached with
 * the delivery tag; admin rate mutations revalidate it next to their path
 * revalidation.
 */
async function getDeliveryFloorFresh(): Promise<{ minHome: number } | null> {
  try {
    const cheapest = await prisma.deliveryRate.findFirst({
      where: { method: "HOME", isActive: true, wilaya: { isActive: true } },
      orderBy: { price: "asc" },
      select: { price: true },
    });
    return cheapest ? { minHome: cheapest.price } : null;
  } catch (error) {
    console.error("[delivery] floor failed", error instanceof Error ? error.name : "unknown");
    return null;
  }
}

const getDeliveryFloorCached = unstable_cache(
  async () => getDeliveryFloorFresh(),
  ["delivery:floor"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CACHE_TAG_DELIVERY] },
);

export async function getDeliveryFloor(): Promise<{ minHome: number } | null> {
  return getDeliveryFloorCached();
}

export async function resolveDeliveryRate(
  wilayaId: string,
  method: DeliveryMethod,
  db: DbClient = prisma,
): Promise<{ price: number; etaMinDays: number; etaMaxDays: number }> {
  const rate = await db.deliveryRate.findFirst({
    where: { wilayaId, method, isActive: true },
  });
  if (!rate) {
    throw new AppError(
      "DELIVERY_UNAVAILABLE",
      "The selected delivery method is no longer available for this region. Please choose another option.",
      409,
    );
  }
  return { price: rate.price, etaMinDays: rate.etaMinDays, etaMaxDays: rate.etaMaxDays };
}
