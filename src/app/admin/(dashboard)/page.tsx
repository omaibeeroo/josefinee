import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { getDashboardStats, getLowStockProducts, getOrdersSeries, resolveRange } from "@/server/admin-analytics";
import { BarList, Card, LineChart, PageHeader, StatCard } from "@/components/admin/ui";
import { formatDA } from "@/lib/money";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const RANGE_KEYS = ["today", "7", "30", "90"] as const;

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePermission("dashboard:read");
  const params = await searchParams;
  const preset = params.range ?? "30";
  const range = resolveRange(RANGE_KEYS.some((value) => value === preset) ? preset : "30");

  const [stats, series, lowStock, t] = await Promise.all([
    getDashboardStats(range),
    getOrdersSeries(range),
    getLowStockProducts(8),
    getDictionary(),
  ]);
  const rangeLabels: Record<(typeof RANGE_KEYS)[number], string> = {
    today: t.adminDash.today,
    "7": t.adminDash.days7,
    "30": t.adminDash.days30,
    "90": t.adminDash.days90,
  };

  return (
    <div>
      <PageHeader
        title={t.adminDash.title}
        description={t.adminDash.desc}
        action={
          <div className="flex gap-1 border hairline bg-white p-1" role="group" aria-label={t.adminDash.range}>
            {RANGE_KEYS.map((value) => (
              <Link
                key={value}
                href={`/admin?range=${value}`}
                aria-current={preset === value ? "true" : undefined}
                className={`px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] ${
                  preset === value ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink"
                }`}
              >
                {rangeLabels[value]}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.adminDash.revenue} value={formatDA(stats.revenue)} hint={`${stats.deliveredOrders} ${t.adminDash.deliveredOrders}`} />
        <StatCard label={t.adminDash.orders} value={String(stats.orderCount)} hint={`${t.adminDash.aov} ${formatDA(stats.averageOrderValue)}`} />
        <StatCard label={t.adminDash.pending} value={String(stats.pendingOrders)} href="/admin/orders?status=PENDING" />
        <StatCard label={t.adminDash.cancelled} value={`${stats.cancellationRate}%`} hint={`${stats.failedDeliveries} ${t.adminDash.failedDeliveries}`} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminDash.overTime}</h2>
          <LineChart data={series.map((point) => ({ date: point.date.slice(5), value: point.orders }))} label={t.adminAnalytics.trendChart} />
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminDash.revenueOverTime}</h2>
          <LineChart data={series.map((point) => ({ date: point.date.slice(5), value: point.revenue }))} label={t.adminAnalytics.trendChart} />
        </Card>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminDash.topProducts}</h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.adminDash.noSales}</p>
          ) : (
            <BarList
              items={stats.topProducts.map((product) => ({
                label: product.name,
                value: product.soldCount,
                display: `${product.soldCount} ${t.adminDash.soldSuffix}`,
              }))}
            />
          )}
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminDash.salesByWilaya}</h2>
          {stats.salesByWilaya.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.adminDash.noOrdersPeriod}</p>
          ) : (
            <BarList
              items={stats.salesByWilaya.map((entry) => ({
                label: entry.wilaya,
                value: entry.orders,
                display: `${entry.orders} ${t.adminDash.ordersSuffix}`,
              }))}
            />
          )}
        </Card>
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.14em]">{t.adminDash.lowStock}</h2>
            <Link href="/admin/inventory" className="text-xs uppercase tracking-[0.12em] underline underline-offset-2">
              {t.adminDash.viewAll}
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.adminDash.stockHealthy}</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {lowStock.map((item) => (
                <li key={item.variantId} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {item.productName}
                    {item.optionLabel ? ` · ${item.optionLabel}` : ""}
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${item.stock === 0 ? "text-[#9e342e]" : "text-amber-700"}`}>
                    {t.adminDash.stockLeft.replace("{count}", String(item.stock))}
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
