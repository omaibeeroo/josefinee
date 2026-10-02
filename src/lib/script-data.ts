const PIXEL_ID_PATTERNS = {
  ga: /^(?:G-[A-Z0-9]+|UA-[0-9]+-[0-9]+)$/i,
  meta: /^[0-9]{5,20}$/,
  tiktok: /^[A-Za-z0-9_-]{2,64}$/,
} as const;

/** JSON serialization safe inside an HTML script element (not an HTML attribute). */
export function serializeForInlineJsonScript(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError("Value is not JSON serializable.");
  return json.replace(/[<>&\u2028\u2029]/g, (character) => {
    switch (character) {
      case "<": return "\\u003c";
      case ">": return "\\u003e";
      case "&": return "\\u0026";
      case "\u2028": return "\\u2028";
      default: return "\\u2029";
    }
  });
}

export function validatedPixelId(provider: keyof typeof PIXEL_ID_PATTERNS, value: string): string {
  const candidate = value.trim();
  return candidate.length <= 64 && PIXEL_ID_PATTERNS[provider].test(candidate) ? candidate : "";
}
