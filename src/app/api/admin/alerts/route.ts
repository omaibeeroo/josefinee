import { getAdminSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role.name !== "SUPER_ADMIN") {
    const codes = session.user.role.permissions.map((entry) => entry.permission.code);
    if (!codes.includes("orders:read")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
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

  return Response.json({
    pendingCount,
    latestOrderNumber: latest?.orderNumber ?? null,
  });
}
