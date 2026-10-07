import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { listPromotionsAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { PromotionManager } from "./promotion-manager";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  await requirePermission("promotions:read");
  const [promotions, collections, t] = await Promise.all([
    listPromotionsAdmin(),
    prisma.collection.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    getDictionary(),
  ]);
  return (
    <div>
      <PageHeader
        title={t.adminPages.promotionsTitle}
        description={t.adminPages.promotionsDesc}
      />
      <PromotionManager promotions={promotions} collections={collections} />
    </div>
  );
}
