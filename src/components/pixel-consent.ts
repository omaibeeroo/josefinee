export const COOKIE_CONSENT_STORAGE_KEY = "hanadi-cookie-consent";
export type CookieConsent = "accepted" | "rejected";

export function hasAnalyticsConsent(value: string | null): boolean {
  return value === "accepted";
}
