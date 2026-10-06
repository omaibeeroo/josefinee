import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listInventory } from "@/server/actions/admin-inventory";
import { PageHeader } from "@/components/admin/ui";
import { StockAdjuster } from "./stock-adjuster";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("inventory:read");
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

  const filters = {
    search: pick(params.search) || undefined,
    lowOnly: pick(params.low) === "1",
    page: pick(params.page) ? Number.parseInt(pick(params.page), 10) || 1 : 1,
  };
  const result = await listInventory(filters);

  return (
    <div>
      <PageHeader title="Stock" description={`${result.total} variantes suivies. Chaque mouvement de stock est journalisé avec un motif.`} />

      <form method="get" className="mb-4 flex flex-col gap-2 border hairline bg-white p-4 sm:flex-row sm:items-center">
        <input name="search" defaultValue={filters.search} placeholder="SKU or product…" className="field min-h-10 flex-1" aria-label="Search inventory" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={filters.lowOnly} className="h-4 w-4 accent-[#1c1a17]" />
          Low stock only
        </label>
        <button type="submit" className="btn btn-primary min-h-10 px-6 text-xs">
          Search
        </button>
        <Link href="/admin/inventory" className="btn btn-ghost min-h-10 px-4 text-xs">
          Clear
        </Link>
      </form>

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Available</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((item) => (
              <tr key={item.variantId} className={cn(item.available <= item.threshold && "bg-amber-50/60")}>
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${item.productId}`} className="font-medium hover:underline">
                    {item.productName}
                  </Link>
                  <span className="block text-xs text-ink-muted">{item.optionLabel ?? "Default"}</span>
                </td>
                <td className="px-4 py-3 text-xs">{item.sku}</td>
                <td className={cn("px-4 py-3 font-semibold tabular-nums", item.available === 0 && "text-[#9e342e]")}>
                  {item.available}
                  {item.reserved > 0 && <span className="ml-1 text-xs font-normal text-ink-muted">({item.reserved} reserved)</span>}
                </td>
                <td className="px-4 py-3 tabular-nums">{item.stock}</td>
                <td className="px-4 py-3">
                  <StockAdjuster variantId={item.variantId} current={item.stock} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">No variants found.</p>}
      </div>
    </div>
  );
}
