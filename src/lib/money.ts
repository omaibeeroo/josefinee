import { BRAND_CONFIG } from "@/config/brand";

/**
 * Formats an integer amount in Algerian dinars, e.g. 2300 -> "2 300 DA".
 * Monetary values are stored as whole dinars (never floats) to avoid rounding.
 */
export function formatDA(amount: number): string {
  return `${formatNumber(amount)} ${BRAND_CONFIG.currencySymbol}`;
}

/**
 * Deterministic French grouping ("1 234 567") with plain spaces.
 * Implemented by hand instead of `Intl.NumberFormat` so the server render
 * and the client hydration always produce byte-identical output regardless
 * of ICU builds (a classic hydration-mismatch source).
 */
export function formatNumber(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped}`;
}

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const MONTHS_BY_LOCALE: Record<string, string[]> = { en: MONTHS_EN, ar: MONTHS_AR };

/**
 * Deterministic date ("6 octobre 2026" / "6 October 2026" / "6 أكتوبر 2026")
 * in UTC so the server render and every client agree exactly —
 * `toLocaleDateString` varies with ICU data and time zones and breaks
 * hydration. Digits stay Western (Algerian convention, including Arabic).
 * Pass the visitor locale (defaults to French); every call site must forward
 * `t.locale`.
 */
export function formatDateFR(value: Date | string | number, locale = "fr"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const months = MONTHS_BY_LOCALE[locale] ?? MONTHS_FR;
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Deterministic date + time ("6 octobre 2026, 14:32", UTC). */
export function formatDateTimeFR(value: Date | string | number, locale = "fr"): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDateFR(date, locale)}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
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
