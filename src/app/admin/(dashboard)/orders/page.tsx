import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listOrders } from "@/server/actions/admin-orders";
import { prisma } from "@/lib/prisma";
import { OrderStatusBadge, PageHeader, RiskBadge } from "@/components/admin/ui";
import { formatDA, formatDateFR } from "@/lib/money";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "FAILED_DELIVERY",
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("orders:read");
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";

  const filters = {
    status: pick(params.status) || undefined,
    wilayaId: pick(params.wilayaId) || undefined,
    search: pick(params.search) || undefined,
    risk: pick(params.risk) || undefined,
    from: pick(params.from) || undefined,
    to: pick(params.to) || undefined,
    page: pick(params.page) ? Number.parseInt(pick(params.page), 10) || 1 : 1,
  };

  const [result, wilayas, t] = await Promise.all([
    listOrders(filters),
    prisma.wilaya.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }).catch(() => []),
    getDictionary(),
  ]);

  const query = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, ...overrides })) {
      if (value && key !== "page") next.set(key, String(value));
    }
    if (overrides.page) next.set("page", overrides.page);
    const queryString = next.toString();
    return queryString ? `/admin/orders?${queryString}` : "/admin/orders";
  };

  const exportHref = (() => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value && key !== "page") next.set(key, String(value));
    }
    const queryString = next.toString();
    return queryString ? `/api/admin/orders/export?${queryString}` : "/api/admin/orders/export";
  })();

  return (
    <div>
      <PageHeader
        title={t.adminOrders.title}
        description={t.adminPages.ordersDesc.replace("{total}", String(result.total))}
        action={
          <a href={exportHref} className="btn btn-ghost min-h-10 px-4 text-xs">
            {t.adminOrders.exportCsv}
          </a>
        }
      />

      <form method="get" className="mb-4 grid gap-2 border hairline bg-white p-4 md:grid-cols-6">
        <input name="search" defaultValue={filters.search} placeholder={t.adminOrders.searchPh} className="field min-h-10 md:col-span-2" aria-label={t.adminOrders.searchLabel} />
        <select name="status" defaultValue={filters.status ?? ""} className="field min-h-10" aria-label={t.adminOrders.status}>
          <option value="">{t.adminOrders.allStatuses}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.status[status as keyof typeof t.status]}
            </option>
          ))}
        </select>
        <select name="wilayaId" defaultValue={filters.wilayaId ?? ""} className="field min-h-10" aria-label={t.adminOrders.wilayaLabel}>
          <option value="">{t.adminOrders.allWilayas}</option>
          {wilayas.map((wilaya) => (
            <option key={wilaya.id} value={wilaya.id}>
              {String(wilaya.code).padStart(2, "0")} — {wilaya.name}
            </option>
          ))}
        </select>
        <select name="risk" defaultValue={filters.risk ?? ""} className="field min-h-10" aria-label={t.adminOrders.risk}>
          <option value="">{t.adminOrders.allRisk}</option>
          <option value="LOW">{t.adminOrders.low}</option>
          <option value="MEDIUM">{t.adminOrders.medium}</option>
          <option value="HIGH">{t.adminOrders.high}</option>
        </select>
        <div className="flex gap-2 md:col-span-6 lg:col-span-1">
          <button type="submit" className="btn btn-primary min-h-10 flex-1 px-4 text-xs">
            {t.adminOrders.filter}
          </button>
          <Link href="/admin/orders" className="btn btn-ghost min-h-10 px-4 text-xs">
            {t.adminOrders.clear}
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[880px] text-start text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">{t.adminOrders.colOrder}</th>
              <th className="px-4 py-3">{t.adminOrders.colCustomer}</th>
              <th className="px-4 py-3">{t.adminOrders.colDestination}</th>
              <th className="px-4 py-3">{t.adminOrders.colItems}</th>
              <th className="px-4 py-3">{t.adminOrders.colTotal}</th>
              <th className="px-4 py-3">{t.adminOrders.colStatus}</th>
              <th className="px-4 py-3">{t.adminOrders.colRisk}</th>
              <th className="px-4 py-3">{t.adminOrders.colPlaced}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((order) => (
              <tr key={order.id} className="hover:bg-cream/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                    <bdi>{order.orderNumber}</bdi>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {order.firstName} {order.lastName}
                  <span className="block text-xs text-ink-muted"><bdi>{order.phone}</bdi></span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {order.communeName}, {order.wilayaName}
                </td>
                <td className="px-4 py-3 tabular-nums">{order._count.items}</td>
                <td className="px-4 py-3 font-medium tabular-nums">{formatDA(order.total, t.locale)}</td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} label={t.status[order.status]} />
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={order.riskLevel} />
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {formatDateFR(order.createdAt, t.locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">{t.adminOrders.noOrdersMatch}</p>
        )}
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
