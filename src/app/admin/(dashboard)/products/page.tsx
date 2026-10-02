import Link from "next/link";
import Image from "next/image";
import { requirePermission } from "@/lib/auth/rbac";
import { listAdminProducts } from "@/server/actions/admin-catalog";
import { PageHeader } from "@/components/admin/ui";
import { formatDA } from "@/lib/money";
import { ProductRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("products:read");
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

  const filters = {
    search: pick(params.search) || undefined,
    status: pick(params.status) || undefined,
    page: pick(params.page) ? Number.parseInt(pick(params.page), 10) || 1 : 1,
  };
  const result = await listAdminProducts(filters);

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${result.total} products.`}
        action={
          <Link href="/admin/products/new" className="btn btn-primary min-h-10 px-5 text-xs">
            New product
          </Link>
        }
      />

      <form method="get" className="mb-4 flex flex-col gap-2 border hairline bg-white p-4 sm:flex-row">
        <input name="search" defaultValue={filters.search} placeholder="Name, SKU, slug…" className="field min-h-10 flex-1" aria-label="Search products" />
        <select name="status" defaultValue={filters.status ?? ""} className="field min-h-10 sm:w-48" aria-label="Status">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button type="submit" className="btn btn-primary min-h-10 px-6 text-xs">
          Search
        </button>
      </form>

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Sold</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((product) => (
              <tr key={product.id} className="hover:bg-cream/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-10 shrink-0 overflow-hidden bg-cream">
                      {product.images[0] && (
                        <Image src={product.images[0].url} alt={product.name} fill sizes="40px" className="object-cover" />
                      )}
                    </div>
                    <div>
                      <Link href={`/admin/products/${product.id}`} className="font-medium hover:underline">
                        {product.name}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {product.sku ?? "no SKU"} · {product.category?.name ?? "uncategorized"} · {product.variantCount} variants
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{formatDA(product.price)}</td>
                <td className="px-4 py-3 tabular-nums">
                  <span className={product.stock === 0 ? "font-semibold text-[#9e342e]" : ""}>
                    {product.stock}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">{product.soldCount}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-[0.1em]">{product.status}</td>
                <td className="px-4 py-3">
                  <ProductRowActions id={product.id} status={product.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">No products found.</p>
        )}
      </div>

      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <span className="text-ink-muted">
            Page {result.page} of {result.totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
