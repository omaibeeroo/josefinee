const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const UNSAFE_FORWARDING_HEADERS = new Set(["forwarded", "via", "x-forwarded", "x-forwarded-for"]);

/**
 * Accept only a dedicated single-hop client-IP header that the trusted edge
 * strips from inbound requests and overwrites before forwarding to the app.
 */
export function isTrustedClientIpHeaderName(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(
    normalized &&
    HEADER_NAME_PATTERN.test(normalized) &&
    !UNSAFE_FORWARDING_HEADERS.has(normalized),
  );
}
