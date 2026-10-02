import { isIP } from "node:net";

type HeaderReader = Pick<Headers, "get">;

/**
 * Reads the single client address supplied by the deployment's trusted edge.
 * The edge must overwrite the configured header; never expose the app directly.
 * X-Forwarded-For is used only as a local-development fallback.
 */
export function extractClientIp(
  headers: HeaderReader,
  options: { production?: boolean; trustedHeader?: string } = {},
): string | null {
  const production = options.production ?? process.env.NODE_ENV === "production";
  const trustedHeader = options.trustedHeader ?? process.env.TRUSTED_CLIENT_IP_HEADER ?? "x-real-ip";
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(trustedHeader)) return null;

  const trustedValue = headers.get(trustedHeader)?.trim();
  if (trustedValue && !trustedValue.includes(",") && isIP(trustedValue) !== 0) return trustedValue;
  if (production) return null;

  const localForwardedValue = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return localForwardedValue && isIP(localForwardedValue) !== 0 ? localForwardedValue : null;
}
