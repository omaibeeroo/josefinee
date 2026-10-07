import { requirePermission } from "@/lib/auth/rbac";
import { listCategoriesAdmin } from "@/server/actions/admin-catalog";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { CategoryManager } from "./category-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requirePermission("catalog:write");
  const [categories, t] = await Promise.all([listCategoriesAdmin(), getDictionary()]);
  return (
    <div>
      <PageHeader title={t.adminPages.categoriesTitle} description={t.adminPages.categoriesDesc} />
      <CategoryManager categories={categories} />
    </div>
  );
}
