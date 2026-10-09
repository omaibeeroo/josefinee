import { BRAND_CONFIG } from "@/config/brand";

/**
 * Unicode isolates for bidi safety (see below). Plain-text channels
 * (SMS/email) must never receive them: U+2066/U+2069 fall outside GSM-7
 * and would force UCS-2 encoding, halving SMS length. Notifications therefore
 * always call formatDA without a locale.
 */
const LRI = String.fromCodePoint(0x2066); // LEFT-TO-RIGHT ISOLATE
const PDI = String.fromCodePoint(0x2069); // POP DIRECTIONAL ISOLATE

/**
 * Wraps a Latin code (order number, coupon, SKU) so hyphenated codes keep
 * logical order inside RTL sentences. Invisible in LTR output.
 */
export function bidiIsolate(text: string): string {
  return `${LRI}${text}${PDI}`;
}

/**
 * Formats an integer amount in Algerian dinars, e.g. 2300 -> "2 300 DA".
 * Monetary values are stored as whole dinars (never floats) to avoid rounding.
 * Pass the visitor locale: in RTL locales the result is wrapped in Unicode
 * isolates so digits, spaces and the currency code keep logical order inside
 * Arabic sentences. Omit it for provider payloads (SMS/email stay GSM-safe).
 */
export function formatDA(amount: number, locale = "fr"): string {
  const text = `${formatNumber(amount)} ${BRAND_CONFIG.currencySymbol}`;
  return locale === "ar" ? `${LRI}${text}${PDI}` : text;
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
  options?: { currency?: string; symbol?: string; locale?: string },
): string {
  const symbol = options?.symbol ?? BRAND_CONFIG.currencySymbol;
  const currency = options?.currency ?? BRAND_CONFIG.currency;
  if (currency === "DZD" || symbol === "DA") return formatDA(amount, options?.locale);
  return `${formatNumber(amount)} ${symbol}`;
}

export function discountPercent(price: number, compareAt?: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
