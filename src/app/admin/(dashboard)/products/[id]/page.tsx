import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getProductForEdit } from "@/server/actions/admin-catalog";
import { ProductEditor, type EditorState } from "@/components/admin/product-editor";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("products:write");
  const { id } = await params;
  const product = await getProductForEdit(id).catch(() => null);
  if (!product) notFound();

  const [categories, t] = await Promise.all([
    prisma.category
      .findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      .catch(() => []),
    getDictionary(),
  ]);

  const initial: EditorState = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    shortDescription: product.shortDescription ?? "",
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice !== null ? String(product.compareAtPrice) : "",
    costPrice: product.costPrice !== null ? String(product.costPrice) : "",
    categoryId: product.categoryId ?? "",
    tags: product.tags.join(", "),
    status: product.status,
    isFeatured: product.isFeatured,
    isBestseller: product.isBestseller,
    isNew: product.isNew,
    material: product.material ?? "",
    color: product.color ?? "",
    size: product.size ?? "",
    weight: product.weight !== null ? String(product.weight) : "",
    dimensions: product.dimensions ?? "",
    careInstructions: product.careInstructions ?? "",
    shippingInfo: product.shippingInfo ?? "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    seoImage: product.seoImage ?? "",
    options: product.options.map((option) => ({
      name: option.name,
      values: option.values.map((value) => ({ value: value.value, hexColor: value.hexColor ?? undefined })),
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      barcode: variant.barcode ?? "",
      price: variant.price !== null ? String(variant.price) : "",
      compareAtPrice: variant.compareAtPrice !== null ? String(variant.compareAtPrice) : "",
      imageUrl: variant.imageUrl ?? "",
      selections: variant.selections,
      stock: variant.stock,
      lowStockThreshold: variant.lowStockThreshold,
      isActive: variant.isActive,
    })),
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      storageKey: image.storageKey ?? undefined,
      alt: image.alt ?? "",
    })),
  };

  return (
    <div>
      <PageHeader title={`${t.adminPages.productEdit} ${product.name}`} description={`/${product.slug}`} />
      <ProductEditor initial={initial} categories={categories} />
    </div>
  );
}
