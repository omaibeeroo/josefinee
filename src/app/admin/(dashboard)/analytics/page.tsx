import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { getDashboardStats, getOrdersSeries, resolveRange } from "@/server/admin-analytics";
import { BarList, Card, LineChart, PageHeader, StatCard } from "@/components/admin/ui";
import { formatDA } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePermission("analytics:read");
  const params = await searchParams;
  const preset = params.range ?? "30";
  const range = resolveRange(RANGES.some((entry) => entry.value === preset) ? preset : "30");

  const [stats, series] = await Promise.all([getDashboardStats(range), getOrdersSeries(range)]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Revenue counts delivered orders only."
        action={
          <div className="flex gap-1 border hairline bg-white p-1" role="group" aria-label="Date range">
            {RANGES.map((entry) => (
              <Link
                key={entry.value}
                href={`/admin/analytics?range=${entry.value}`}
                aria-current={preset === entry.value ? "true" : undefined}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em]",
                  preset === entry.value ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink",
                )}
              >
                {entry.label}
              </Link>
            ))}
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={formatDA(stats.revenue)} hint={`${stats.deliveredOrders} delivered`} />
        <StatCard label="Orders" value={String(stats.orderCount)} hint={`Gross ${formatDA(stats.grossTotal)}`} />
        <StatCard label="Average order value" value={formatDA(stats.averageOrderValue)} />
        <StatCard label="Delivered rate" value={`${stats.deliveredRate}%`} hint={`${stats.failedDeliveries} failed deliveries`} />
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">Orders</h2>
          <LineChart data={series.map((point) => ({ date: point.date.slice(5), value: point.orders }))} />
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">Revenue</h2>
          <LineChart data={series.map((point) => ({ date: point.date.slice(5), value: point.revenue }))} />
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">Top products</h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-ink-muted">No sales yet.</p>
          ) : (
            <BarList items={stats.topProducts.map((product) => ({ label: product.name, value: product.soldCount, display: `${product.soldCount} sold` }))} />
          )}
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">Top wilayas</h2>
          {stats.salesByWilaya.length === 0 ? (
            <p className="text-sm text-ink-muted">No orders in this period.</p>
          ) : (
            <BarList items={stats.salesByWilaya.map((entry) => ({ label: entry.wilaya, value: entry.total, display: formatDA(entry.total) }))} />
          )}
        </Card>
      </div>
    </div>
  );
}
