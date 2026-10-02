import "server-only";
import { createHash } from "crypto";

/**
 * Meta Conversions API (server-side Purchase events).
 * Complements the browser pixel: both carry the same event_id so Meta
 * deduplicates instead of double-counting. PII is SHA-256 hashed per Meta's
 * spec. Fully optional — without credentials this is a silent no-op, and
 * failures never affect ordering.
 */

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashPhone(phone: string): string {
  // 0XXXXXXXXX -> 213XXXXXXXXX (digits only, no plus).
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `213${digits.slice(1)}` : digits;
  return sha256(normalized);
}

export async function sendMetaPurchase(input: {
  orderNumber: string;
  total: number;
  email?: string | null;
  phone?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<boolean> {
  const pixelId = process.env.META_PIXEL_ID ?? process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CONVERSIONS_API_KEY;
  if (!pixelId || !token) return true;

  const eventId = `purchase-${input.orderNumber}`;
  const userData: Record<string, string | string[]> = {};
  if (input.email) userData.em = [sha256(input.email.trim().toLowerCase())];
  if (input.phone) userData.ph = [hashPhone(input.phone)];
  if (input.ip) userData.client_ip_address = input.ip;
  if (input.userAgent) userData.client_user_agent = input.userAgent;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: "Purchase",
              event_time: Math.floor(Date.now() / 1000),
              event_id: eventId,
              action_source: "website",
              user_data: userData,
              custom_data: { currency: "DZD", value: input.total, order_id: input.orderNumber },
            },
          ],
        }),
      },
    );
    if (!response.ok) {
      console.error("[meta-capi] rejected", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[meta-capi] failed", error instanceof Error ? error.name : "unknown");
    return false;
  }
}
