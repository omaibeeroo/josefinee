import { requirePermission } from "@/lib/auth/rbac";
import { exportOrdersCsv } from "@/server/actions/admin-orders";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePermission("orders:export");
  } catch (error) {
    const { isAppError } = await import("@/lib/errors");
    if (isAppError(error)) {
      return Response.json({ ok: false, error: error.userMessage }, { status: error.status });
    }
    return Response.json({ ok: false, error: "Something went wrong." }, { status: 500 });
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
    return Response.json({ ok: false, error: "Invalid export filters." }, { status: 400 });
  }
  const csv = await exportOrdersCsv({
    ...parsed.data,
  });

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
