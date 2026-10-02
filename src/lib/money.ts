import { BRAND_CONFIG } from "@/config/brand";

/**
 * Formats an integer amount in Algerian dinars, e.g. 2300 -> "2 300 DA".
 * Monetary values are stored as whole dinars (never floats) to avoid rounding.
 */
export function formatDA(amount: number): string {
  return `${formatNumber(amount)} ${BRAND_CONFIG.currencySymbol}`;
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPrice(
  amount: number,
  options?: { currency?: string; symbol?: string },
): string {
  const symbol = options?.symbol ?? BRAND_CONFIG.currencySymbol;
  const currency = options?.currency ?? BRAND_CONFIG.currency;
  if (currency === "DZD" || symbol === "DA") return formatDA(amount);
  return `${formatNumber(amount)} ${symbol}`;
}

export function discountPercent(price: number, compareAt?: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
