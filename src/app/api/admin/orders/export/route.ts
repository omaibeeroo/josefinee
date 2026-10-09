import { requirePermission } from "@/lib/auth/rbac";
import { exportOrdersCsv } from "@/server/actions/admin-orders";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  let actorId: string;
  try {
    const actor = await requirePermission("orders:export");
    actorId = actor.id;
  } catch (error) {
    const { isAppError } = await import("@/lib/errors");
    if (isAppError(error)) {
      return Response.json({ ok: false, error: error.userMessage }, { status: error.status, headers: NO_STORE });
    }
    return Response.json({ ok: false, error: "Something went wrong." }, { status: 500, headers: NO_STORE });
  }
  try {
    await enforceRateLimit({ ...LIMITS.export, key: `orders-export:${actorId}` });
  } catch {
    return Response.json({ ok: false, error: "Too many export requests." }, { status: 429, headers: NO_STORE });
  }
  const { searchParams } = new URL(request.url);
  const parsed = z
    .object({
      status: z
        .enum([
          "PENDING",
          "CONFIRMED",
          "PROCESSING",
          "PACKED",
          "SHIPPED",
          "OUT_FOR_DELIVERY",
          "DELIVERED",
          "CANCELLED",
          "RETURNED",
          "FAILED_DELIVERY",
        ])
        .optional(),
      risk: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
      wilayaId: z.string().max(100).optional(),
      search: z.string().max(100).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
    .safeParse(Object.fromEntries(searchParams.entries()));
  if (
    !parsed.success ||
    (parsed.data.from && parsed.data.to && new Date(parsed.data.from) > new Date(parsed.data.to))
  ) {
    return Response.json({ ok: false, error: "Invalid export filters." }, { status: 400, headers: NO_STORE });
  }
  const csv = await exportOrdersCsv({
    ...parsed.data,
  });

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      ...NO_STORE,
    },
  });
}
