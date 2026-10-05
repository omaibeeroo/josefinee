import { clientIp, enforceRateLimit, LIMITS } from "@/lib/rate-limit";

const MAX_REPORT_BYTES = 16 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

async function readLimitedBody(request: Request): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BYTES) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REPORT_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Receives Content-Security-Policy violation reports.
 * Reports are bounded, rate-limited and discarded after optional development logging.
 */
export async function POST(request: Request) {
  try {
    const ip = await clientIp();
    await enforceRateLimit({ ...LIMITS.cspReport, key: `csp-report:${ip}` });
    const body = await readLimitedBody(request);
    if (process.env.NODE_ENV === "development" && body) {
      try {
        console.warn("[csp] violation report", JSON.stringify(JSON.parse(body)).slice(0, 1000));
      } catch {
        // Ignore malformed telemetry bodies.
      }
    }
  } catch {
    // Telemetry must never affect application behavior or reveal rate-limit state.
  }
  return new Response(null, { status: 204, headers: NO_STORE });
}
