import "server-only";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { DELIVERY_METHOD_LABELS } from "@/lib/constants";
import type { DeliveryMethod } from "@prisma/client";

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
  try {
    const rows = await prisma.wilaya.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, nameAr: true, stopdeskAvailable: true },
    });
    return rows;
  } catch (error) {
    console.error("[delivery] wilayas failed", error);
    return [];
  }
}

export async function getCommunes(wilayaId: string): Promise<CommuneOption[]> {
  if (!wilayaId) return [];
  try {
    return await prisma.commune.findMany({
      where: { wilayaId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch (error) {
    console.error("[delivery] communes failed", error);
    return [];
  }
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

export async function resolveDeliveryRate(
  wilayaId: string,
  method: DeliveryMethod,
): Promise<{ price: number; etaMinDays: number; etaMaxDays: number }> {
  const rate = await prisma.deliveryRate.findFirst({
    where: { wilayaId, method, isActive: true },
  });
  if (!rate) {
    // Fall back to home delivery for this wilaya if the chosen method is unavailable.
    const fallback = await prisma.deliveryRate.findFirst({
      where: { wilayaId, method: "HOME", isActive: true },
    });
    if (!fallback) {
      throw new AppError(
        "DELIVERY_UNAVAILABLE",
        "Delivery is not available for the selected region. Please contact support.",
        409,
      );
    }
    return {
      price: fallback.price,
      etaMinDays: fallback.etaMinDays,
      etaMaxDays: fallback.etaMaxDays,
    };
  }
  return { price: rate.price, etaMinDays: rate.etaMinDays, etaMaxDays: rate.etaMaxDays };
}
