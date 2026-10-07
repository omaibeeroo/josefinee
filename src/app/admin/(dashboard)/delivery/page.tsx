import { requirePermission } from "@/lib/auth/rbac";
import { listDeliveryRates } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { DeliveryManager } from "./delivery-manager";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage() {
  await requirePermission("delivery:read");
  const [wilayas, t] = await Promise.all([listDeliveryRates(), getDictionary()]);
  return (
    <div>
      <PageHeader
        title={t.adminPages.deliveryTitle}
        description={t.adminPages.deliveryDesc}
      />
      <DeliveryManager wilayas={wilayas} />
    </div>
  );
}
