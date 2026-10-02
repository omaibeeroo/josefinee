/**
 * Algerian phone number normalization & validation.
 *
 * COD depends on reachable mobile numbers, so we accept the common Algerian
 * mobile formats and normalize everything to the local `0XXXXXXXXX` form
 * (10 digits, starting 05 / 06 / 07).
 *
 * Accepted inputs:
 *   0550123456        0600 11 22 33      07-11-22-33-44
 *   +213550123456     +213 6 00 11 22 33 00213550123456
 */

const MOBILE_PREFIXES = ["5", "6", "7"];

export function normalizeAlgerianPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = String(input).trim();
  value = value.replace(/[\s().-]/g, "");

  if (value.startsWith("+")) value = value.slice(1);
  if (value.startsWith("00")) value = value.slice(2);

  if (value.startsWith("213")) {
    value = `0${value.slice(3)}`;
  }

  if (!/^\d+$/.test(value)) return null;
  if (value.length !== 10) return null;
  if (!value.startsWith("0")) return null;
  if (!MOBILE_PREFIXES.includes(value[1] ?? "")) return null;

  return value;
}

export function isValidAlgerianPhone(input: string | null | undefined): boolean {
  return normalizeAlgerianPhone(input) !== null;
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizeAlgerianPhone(phone);
  if (!normalized) return phone;
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 6)} ${normalized.slice(6, 8)} ${normalized.slice(8)}`;
}

export const phoneError = "Please enter a valid Algerian mobile number (e.g. 0550 12 34 56).";
