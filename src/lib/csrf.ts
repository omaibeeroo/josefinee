import "server-only";
import { headers } from "next/headers";
import { AppError } from "./errors";

/**
 * Defense-in-depth CSRF check for route handlers.
 * Next.js server actions already verify Origin/Host automatically; this is
 * used for `route.ts` handlers that mutate state.
 */
export async function assertSameOrigin(): Promise<void> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  const host = headerList.get("host");

  // Fetch metadata: a browser-asserted cross-site request is rejected even
  // when Origin is stripped by the client.
  const secFetchSite = headerList.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    throw new AppError("CSRF", "Invalid request origin.", 403);
  }

  // Non-browser requests (server-to-server) are allowed to reach the handler;
  // authentication still applies. Browser requests carry Origin or Referer.
  if (!origin) {
    const referer = headerList.get("referer");
    if (!referer || !host) return;
    try {
      if (new URL(referer).host !== host) {
        throw new AppError("CSRF", "Invalid request origin.", 403);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("CSRF", "Invalid request origin.", 403);
    }
    return;
  }
  if (!host) throw new AppError("CSRF", "Invalid request.", 403);

  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      throw new AppError("CSRF", "Invalid request origin.", 403);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("CSRF", "Invalid request origin.", 403);
  }
}
