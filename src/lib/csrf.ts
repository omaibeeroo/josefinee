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

  // Non-browser requests (server-to-server) are allowed to reach the handler;
  // authentication still applies. Browser cross-site requests carry Origin.
  if (!origin) return;
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
