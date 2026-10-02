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
      <PageHeader title="Categories" description="Navigation and product grouping. Deleting is only possible when empty." />
      <CategoryManager categories={categories} />
    </div>
  );
}
