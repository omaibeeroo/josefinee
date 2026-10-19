import { requirePermission } from "@/lib/auth/rbac";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { getAdminActionT } from "@/lib/i18n/server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const t = await getAdminActionT();
  try {
    const actor = await requirePermission("orders:read");
    await enforceRateLimit({ ...LIMITS.api, key: `alerts:${actor.id}` });
  } catch (error) {
    const { isAppError } = await import("@/lib/errors");
    if (isAppError(error)) {
      return Response.json(
        { error: error.userMessage },
        { status: error.status, headers: NO_STORE },
      );
    }
    return Response.json({ error: t.forbidden }, { status: 403, headers: NO_STORE });
  }

  const { prisma } = await import("@/lib/prisma");
  const [pendingCount, latest] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.order
      .findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { orderNumber: true },
      })
      .catch(() => null),
  ]);

  return Response.json(
    {
      pendingCount,
      latestOrderNumber: latest?.orderNumber ?? null,
    },
    { headers: NO_STORE },
  );
}
