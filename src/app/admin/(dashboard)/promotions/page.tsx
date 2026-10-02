import { requirePermission } from "@/lib/auth/rbac";
import { listCouponOptions, listPromotionsAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { PromotionManager } from "./promotion-manager";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  await requirePermission("coupons:read");
  const [promotions, options] = await Promise.all([listPromotionsAdmin(), listCouponOptions()]);
  return (
    <div>
      <PageHeader
        title="Promotions"
        description="Automatic time-boxed discounts. The server decides what is live — client clocks are never trusted."
      />
      <PromotionManager promotions={promotions} collections={options.collections} />
    </div>
  );
}
