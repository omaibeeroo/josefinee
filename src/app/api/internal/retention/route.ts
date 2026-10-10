import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit, LIMITS, clientIp } from "@/lib/rate-limit";
import { purgeExpiredData } from "@/server/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.RETENTION_JOB_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(secret, "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await enforceRateLimit({ ...LIMITS.api, key: `internal:retention:${await clientIp()}` });
  } catch {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await purgeExpiredData();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[retention] purge failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { error: "Retention cleanup is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
}
