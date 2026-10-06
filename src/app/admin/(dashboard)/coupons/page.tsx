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
      <PageHeader title="Coupons" description="Les codes sont validés côté serveur — le client ne décide jamais d’une remise." />
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
