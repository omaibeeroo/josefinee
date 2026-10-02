import { requirePermission } from "@/lib/auth/rbac";
import { listDeliveryRates } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { DeliveryManager } from "./delivery-manager";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryPage() {
  await requirePermission("delivery:read");
  const wilayas = await listDeliveryRates();
  return (
    <div>
      <PageHeader
        title="Delivery"
        description="Per-wilaya rates power the checkout. Click any price to edit it. CSV import/export supported."
      />
      <DeliveryManager wilayas={wilayas} />
    </div>
  );
}
