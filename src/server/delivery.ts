import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { DELIVERY_METHOD_LABELS } from "@/lib/constants";
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
  label: string;
  price: number;
  etaMinDays: number;
  etaMaxDays: number;
};

export async function getActiveWilayas(): Promise<WilayaOption[]> {
  return prisma.wilaya.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, nameAr: true, stopdeskAvailable: true },
  });
}

export async function getCommunes(wilayaId: string): Promise<CommuneOption[]> {
  if (!wilayaId) return [];
  return prisma.commune.findMany({
    where: { wilayaId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getDeliveryOptions(wilayaId: string): Promise<DeliveryOption[]> {
  if (!wilayaId) return [];
  const rates = await prisma.deliveryRate.findMany({
    where: { wilayaId, isActive: true },
    orderBy: { price: "asc" },
  });
  return rates.map((rate) => ({
    method: rate.method,
    label: DELIVERY_METHOD_LABELS[rate.method],
    price: rate.price,
    etaMinDays: rate.etaMinDays,
    etaMaxDays: rate.etaMaxDays,
  }));
}

/** Lowest active HOME rate nationwide — an honest "delivery from" estimate. */
export async function getDeliveryFloor(): Promise<{ minHome: number } | null> {
  try {
    const cheapest = await prisma.deliveryRate.findFirst({
      where: { method: "HOME", isActive: true, wilaya: { isActive: true } },
      orderBy: { price: "asc" },
      select: { price: true },
    });
    return cheapest ? { minHome: cheapest.price } : null;
  } catch (error) {
    console.error("[delivery] floor failed", error);
    return null;
  }
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
