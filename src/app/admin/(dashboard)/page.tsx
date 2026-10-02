import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { getDashboardStats, getLowStockProducts, getOrdersSeries, resolveRange } from "@/server/admin-analytics";
import { BarList, Card, LineChart, PageHeader, StatCard } from "@/components/admin/ui";
import { formatDA } from "@/lib/money";

export const dynamic = "force-dynamic";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePermission("dashboard:read");
  const params = await searchParams;
  const preset = params.range ?? "30";
  const range = resolveRange(RANGES.some((entry) => entry.value === preset) ? preset : "30");

  const [stats, series, lowStock] = await Promise.all([
    getDashboardStats(range),
    getOrdersSeries(range),
    getLowStockProducts(8),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Store performance at a glance. All figures come from real orders."
        action={
          <div className="flex gap-1 border hairline bg-white p-1" role="group" aria-label="Date range">
            {RANGES.map((entry) => (
              <Link
                key={entry.value}
                href={`/admin?range=${entry.value}`}
                aria-current={preset === entry.value ? "true" : undefined}
                className={`px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] ${
                  preset === entry.value ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink"
                }`}
              >
                {entry.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (delivered)" value={formatDA(stats.revenue)} hint={`${stats.deliveredOrders} delivered orders`} />
        <StatCard label="Orders" value={String(stats.orderCount)} hint={`AOV ${formatDA(stats.averageOrderValue)}`} />
        <StatCard label="Pending orders" value={String(stats.pendingOrders)} href="/admin/orders?status=PENDING" />
        <StatCard label="Cancelled / failed" value={`${stats.cancellationRate}%`} hint={`${stats.failedDeliveries} failed deliveries`} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">Orders over time</h2>
          <LineChart data={series.map((point) => ({ date: point.date.slice(5), value: point.orders }))} />
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">Revenue over time</h2>
          <LineChart data={series.map((point) => ({ date: point.date.slice(5), value: point.revenue }))} />
        </Card>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">Top products</h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-ink-muted">No sales yet.</p>
          ) : (
            <BarList
              items={stats.topProducts.map((product) => ({
                label: product.name,
                value: product.soldCount,
                display: `${product.soldCount} sold`,
              }))}
            />
          )}
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">Sales by wilaya</h2>
          {stats.salesByWilaya.length === 0 ? (
            <p className="text-sm text-ink-muted">No orders in this period.</p>
          ) : (
            <BarList
              items={stats.salesByWilaya.map((entry) => ({
                label: entry.wilaya,
                value: entry.orders,
                display: `${entry.orders} orders`,
              }))}
            />
          )}
        </Card>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.14em]">Low stock</h2>
            <Link href="/admin/inventory" className="text-xs uppercase tracking-[0.12em] underline underline-offset-2">
              View all
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-ink-muted">Stock levels look healthy.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {lowStock.map((item) => (
                <li key={item.variantId} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {item.productName}
                    {item.optionLabel ? ` · ${item.optionLabel}` : ""}
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${item.stock === 0 ? "text-[#9e342e]" : "text-amber-700"}`}>
                    {item.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
