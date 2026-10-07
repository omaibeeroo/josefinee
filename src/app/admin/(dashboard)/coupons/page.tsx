import { requirePermission } from "@/lib/auth/rbac";
import { listCouponOptions, listCouponsAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { CouponManager } from "./coupon-manager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requirePermission("coupons:read");
  const [coupons, options, t] = await Promise.all([listCouponsAdmin(), listCouponOptions(), getDictionary()]);
  return (
    <div>
      <PageHeader title={t.adminPages.couponsTitle} description={t.adminPages.couponsDesc} />
      <CouponManager
        coupons={coupons.map((coupon) => ({
          ...coupon,
          productSkus: "",
          collectionSlugs: [] as string[],
          wilayaCodes: [] as number[],
        }))}
        collections={options.collections}
        wilayas={options.wilayas}
      />
    </div>
  );
}
