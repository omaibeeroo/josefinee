import Link from "next/link";
import Image from "next/image";
import { requirePermission } from "@/lib/auth/rbac";
import { listInventory } from "@/server/actions/admin-inventory";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
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
  const [result, t] = await Promise.all([listInventory(filters), getDictionary()]);

  const query = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    if (filters.search) next.set("search", filters.search);
    if (filters.lowOnly) next.set("low", "1");
    if (overrides.page) next.set("page", overrides.page);
    const queryString = next.toString();
    return queryString ? `/admin/inventory?${queryString}` : "/admin/inventory";
  };

  return (
    <div>
      <PageHeader title={t.adminPages.inventoryTitle} description={t.adminPages.inventoryDesc.replace("{total}", String(result.total))} />

      <form method="get" className="mb-4 flex flex-col gap-2 border hairline bg-white p-4 sm:flex-row sm:items-center">
        <input name="search" defaultValue={filters.search} placeholder={t.adminInventoryTable.searchPh} className="field min-h-10 flex-1" aria-label={t.adminInventoryTable.searchLabel} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={filters.lowOnly} className="h-4 w-4 accent-[#1c1a17]" />
          {t.adminInventoryTable.lowOnly}
        </label>
        <button type="submit" className="btn btn-primary min-h-10 px-6 text-xs">
          {t.adminInventoryTable.search}
        </button>
        <Link href="/admin/inventory" className="btn btn-ghost min-h-10 px-4 text-xs">
          {t.adminInventoryTable.clear}
        </Link>
      </form>

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[900px] text-start text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">{t.adminInventoryTable.colProduct}</th>
              <th className="px-4 py-3">{t.adminInventoryTable.colSku}</th>
              <th className="px-4 py-3">{t.adminInventoryTable.colAvailable}</th>
              <th className="px-4 py-3">{t.adminInventoryTable.colStock}</th>
              <th className="px-4 py-3">{t.adminInventoryTable.colAdjust}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((item) => (
              <tr key={item.variantId} className={cn(item.available <= item.threshold && "bg-amber-50/60")}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-11 w-10 shrink-0 overflow-hidden bg-cream">
                      {item.productImageUrl && (
                        <Image src={item.productImageUrl} alt={item.productName} fill sizes="40px" unoptimized className="object-cover" />
                      )}
                    </div>
                    <div>
                      <Link href={`/admin/products/${item.productId}`} className="font-medium hover:underline">
                        {item.productName}
                      </Link>
                      <span className="block text-xs text-ink-muted">{item.optionLabel ?? t.adminInventoryTable.defaultVariant}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">{item.sku}</td>
                <td className={cn("px-4 py-3 font-semibold tabular-nums", item.available === 0 && "text-[#9e342e]")}>
                  {item.available}
                  {item.reserved > 0 && <span className="ms-1 text-xs font-normal text-ink-muted">{t.adminInventoryTable.reservedNote.replace("{count}", String(item.reserved))}</span>}
                </td>
                <td className="px-4 py-3 tabular-nums">{item.stock}</td>
                <td className="px-4 py-3">
                  <StockAdjuster variantId={item.variantId} current={item.stock} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">{t.adminInventoryTable.noVariants}</p>}
      </div>

      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {result.page > 1 && (
            <Link href={query({ page: String(result.page - 1) })} className="btn btn-ghost min-h-10 px-4 text-xs">
              {t.pagination.previous}
            </Link>
          )}
          <span className="text-ink-muted">
            {t.pagination.pageOf.replace("{page}", String(result.page)).replace("{total}", String(result.totalPages))}
          </span>
          {result.page < result.totalPages && (
            <Link href={query({ page: String(result.page + 1) })} className="btn btn-ghost min-h-10 px-4 text-xs">
              {t.pagination.next}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
