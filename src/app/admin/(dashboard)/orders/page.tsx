import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listOrders } from "@/server/actions/admin-orders";
import { prisma } from "@/lib/prisma";
import { OrderStatusBadge, PageHeader, RiskBadge } from "@/components/admin/ui";
import { formatDA } from "@/lib/money";

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

  const [result, wilayas] = await Promise.all([
    listOrders(filters),
    prisma.wilaya.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }).catch(() => []),
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
        title="Orders"
        description={`${result.total} orders match these filters.`}
        action={
          <a href={exportHref} className="btn btn-ghost min-h-10 px-4 text-xs">
            Export CSV
          </a>
        }
      />

      <form method="get" className="mb-4 grid gap-2 border hairline bg-white p-4 md:grid-cols-6">
        <input name="search" defaultValue={filters.search} placeholder="Number, phone, name…" className="field min-h-10 md:col-span-2" aria-label="Search orders" />
        <select name="status" defaultValue={filters.status ?? ""} className="field min-h-10" aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select name="wilayaId" defaultValue={filters.wilayaId ?? ""} className="field min-h-10" aria-label="Wilaya">
          <option value="">All wilayas</option>
          {wilayas.map((wilaya) => (
            <option key={wilaya.id} value={wilaya.id}>
              {String(wilaya.code).padStart(2, "0")} — {wilaya.name}
            </option>
          ))}
        </select>
        <select name="risk" defaultValue={filters.risk ?? ""} className="field min-h-10" aria-label="Risk">
          <option value="">All risk levels</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <div className="flex gap-2 md:col-span-6 lg:col-span-1">
          <button type="submit" className="btn btn-primary min-h-10 flex-1 px-4 text-xs">
            Filter
          </button>
          <Link href="/admin/orders" className="btn btn-ghost min-h-10 px-4 text-xs">
            Clear
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((order) => (
              <tr key={order.id} className="hover:bg-cream/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {order.firstName} {order.lastName}
                  <span className="block text-xs text-ink-muted">{order.phone}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {order.communeName}, {order.wilayaName}
                </td>
                <td className="px-4 py-3 tabular-nums">{order._count.items}</td>
                <td className="px-4 py-3 font-medium tabular-nums">{formatDA(order.total)}</td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={order.riskLevel} />
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {new Date(order.createdAt).toLocaleDateString("fr-DZ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">No orders match these filters.</p>
        )}
      </div>

      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {result.page > 1 && (
            <Link href={query({ page: String(result.page - 1) })} className="btn btn-ghost min-h-10 px-4 text-xs">
              Previous
            </Link>
          )}
          <span className="text-ink-muted">
            Page {result.page} of {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={query({ page: String(result.page + 1) })} className="btn btn-ghost min-h-10 px-4 text-xs">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
