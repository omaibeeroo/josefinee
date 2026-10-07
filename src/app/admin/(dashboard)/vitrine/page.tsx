import { requirePermission } from "@/lib/auth/rbac";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { getVitrineData } from "@/server/actions/vitrine";
import { VitrineManager } from "./vitrine-manager";

export const dynamic = "force-dynamic";

export default async function AdminVitrinePage() {
  await requirePermission("products:read");
  const [data, t] = await Promise.all([getVitrineData(), getDictionary()]);
  return (
    <div>
      <PageHeader title={t.adminVitrine.title} description={t.adminVitrine.desc} />
      <VitrineManager data={data} />
    </div>
  );
}
