import { requirePermission } from "@/lib/auth/rbac";
import { listDeliveryRates } from "@/server/actions/admin-ops";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  let actor;
  try {
    actor = await requirePermission("delivery:read");
  } catch (error) {
    const { isAppError } = await import("@/lib/errors");
    if (isAppError(error)) {
      return Response.json({ ok: false, error: error.userMessage }, { status: error.status });
    }
    return Response.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
  const wilayas = await listDeliveryRates();
  const lines = ["wilaya_code,method,price,eta_min,eta_max,active"];
  for (const wilaya of wilayas) {
    for (const rate of wilaya.deliveryRates) {
      lines.push(
        [
          wilaya.code,
          rate.method,
          rate.price,
          rate.etaMinDays,
          rate.etaMaxDays,
          rate.isActive ? 1 : 0,
        ].join(","),
      );
    }
  }
  await recordAudit({
    actorUserId: actor!.id,
    action: "DELIVERY_RATES_EXPORTED",
    resource: "DeliveryRate",
    metadata: { count: lines.length - 1 },
  });
  return new Response(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="delivery-rates-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
