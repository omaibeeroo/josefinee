import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";
import { CollectionManager } from "./collection-manager";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  await requirePermission("catalog:write");

  const [collections, products] = await Promise.all([
    prisma.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: true } },
        products: { select: { productId: true } },
      },
    }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
      take: 2000,
    }),
  ]);

  return (
    <div>
      <PageHeader title="Collections" description="Sélections manuelles et automatiques (Nouveautés, Meilleures ventes, Promotions)." />
      <CollectionManager
        collections={collections.map((collection) => ({
          ...collection,
          description: collection.description,
          image: collection.image,
          productIds: collection.products.map((entry) => entry.productId),
        }))}
        products={products}
      />
    </div>
  );
}
