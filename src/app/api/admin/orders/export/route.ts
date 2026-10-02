import { requirePermission } from "@/lib/auth/rbac";
import { exportOrdersCsv } from "@/server/actions/admin-orders";

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
  const csv = await exportOrdersCsv({
    status: searchParams.get("status") || undefined,
    wilayaId: searchParams.get("wilayaId") || undefined,
    search: searchParams.get("search") || undefined,
    risk: searchParams.get("risk") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  });

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
