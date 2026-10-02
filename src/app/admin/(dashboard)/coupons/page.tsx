import { requirePermission } from "@/lib/auth/rbac";
import { listCouponOptions, listCouponsAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { CouponManager } from "./coupon-manager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requirePermission("coupons:read");
  const [coupons, options] = await Promise.all([listCouponsAdmin(), listCouponOptions()]);
  return (
    <div>
      <PageHeader title="Coupons" description="Discount codes are validated server-side — the client can never dictate a discount." />
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
