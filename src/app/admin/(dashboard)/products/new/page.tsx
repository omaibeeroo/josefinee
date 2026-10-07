import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { EMPTY_EDITOR, ProductEditor } from "@/components/admin/product-editor";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePermission("products:write");
  const [categories, t] = await Promise.all([
    prisma.category
      .findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      .catch(() => []),
    getDictionary(),
  ]);

  return (
    <div>
      <PageHeader title={t.adminPages.productsNewTitle} description={t.adminPages.productsNewDesc} />
      <ProductEditor initial={EMPTY_EDITOR} categories={categories} />
    </div>
  );
}