import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { EMPTY_EDITOR, ProductEditor } from "@/components/admin/product-editor";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePermission("products:write");
  const categories = await prisma.category
    .findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    .catch(() => []);

  return (
    <div>
      <PageHeader title="New product" description="Create a product. It stays a draft until you publish it." />
      <ProductEditor initial={EMPTY_EDITOR} categories={categories} />
    </div>
  );
}
