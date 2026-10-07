const SAFE_BASE = "https://hanadi.invalid";

/** Accept only same-origin absolute paths; never hand router.push an external URL. */
export function safeInternalPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  if ([...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  })) {
    return fallback;
  }

  try {
    const url = new URL(value, SAFE_BASE);
    if (url.origin !== SAFE_BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
