import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { listPromotionsAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { PromotionManager } from "./promotion-manager";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  await requirePermission("promotions:read");
  const [promotions, collections] = await Promise.all([
    listPromotionsAdmin(),
    prisma.collection.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div>
      <PageHeader
        title="Promotions"
        description="Automatic time-boxed discounts. The server decides what is live — client clocks are never trusted."
      />
      <PromotionManager promotions={promotions} collections={collections} />
    </div>
  );
}
