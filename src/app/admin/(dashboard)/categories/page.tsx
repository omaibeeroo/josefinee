import { requirePermission } from "@/lib/auth/rbac";
import { listCategoriesAdmin } from "@/server/actions/admin-catalog";
import { PageHeader } from "@/components/admin/ui";
import { CategoryManager } from "./category-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requirePermission("catalog:write");
  const categories = await listCategoriesAdmin();
  return (
    <div>
      <PageHeader title="Catégories" description="Navigation et regroupement des produits. Suppression possible uniquement si vide." />
      <CategoryManager categories={categories} />
    </div>
  );
}
