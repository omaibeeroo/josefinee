import { storagePublicOrigin } from "@/config/brand";

/**
 * Next's optimizer may fetch only media that is same-origin or from the
 * configured public object-storage host. Signed URLs stay unoptimized because
 * their query credentials can expire while an optimizer cache entry lives.
 */
export function canOptimizeImageUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const configuredOrigin = storagePublicOrigin();
    return Boolean(configuredOrigin && parsed.origin === configuredOrigin && !parsed.search && !parsed.hash);
  } catch {
    return false;
  }
}
