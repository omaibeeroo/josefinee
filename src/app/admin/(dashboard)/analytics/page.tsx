import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { getDashboardStats, getOrdersSeries, resolveRange } from "@/server/admin-analytics";
import { BarList, Card, LineChart, PageHeader, StatCard } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { formatDA } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGE_KEYS = ["today", "7", "30", "90"] as const;

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePermission("analytics:read");
  const params = await searchParams;
  const preset = params.range ?? "30";
  const range = resolveRange(RANGE_KEYS.some((value) => value === preset) ? preset : "30");

  const [stats, series, t] = await Promise.all([getDashboardStats(range), getOrdersSeries(range), getDictionary()]);
  const rangeLabels: Record<(typeof RANGE_KEYS)[number], string> = {
    today: t.adminDash.today,
    "7": t.adminDash.days7,
    "30": t.adminDash.days30,
    "90": t.adminDash.days90,
  };

  return (
    <div>
      <PageHeader
        title={t.adminAnalytics.title}
        description={t.adminDash.desc}
        action={
          <div className="flex gap-1 border hairline bg-white p-1" role="group" aria-label={t.adminDash.range}>
            {RANGE_KEYS.map((value) => (
              <Link
                key={value}
                href={`/admin/analytics?range=${value}`}
                aria-current={preset === value ? "true" : undefined}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em]",
                  preset === value ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink",
                )}
              >
                {rangeLabels[value]}
              </Link>
            ))}
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.adminAnalytics.revenue} value={formatDA(stats.revenue)} hint={`${stats.deliveredOrders} ${t.adminAnalytics.delivered}`} />
        <StatCard label={t.adminAnalytics.orders} value={String(stats.orderCount)} hint={`${t.adminAnalytics.gross} ${formatDA(stats.grossTotal)}`} />
        <StatCard label={t.adminAnalytics.aov} value={formatDA(stats.averageOrderValue)} />
        <StatCard label={t.adminAnalytics.deliveredRate} value={`${stats.deliveredRate}%`} hint={`${stats.failedDeliveries} ${t.adminAnalytics.failedDeliveries}`} />
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminAnalytics.orders}</h2>
          <LineChart data={series.map((point) => ({ date: point.date.slice(5), value: point.orders }))} />
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminAnalytics.revenue}</h2>
          <LineChart data={series.map((point) => ({ date: point.date.slice(5), value: point.revenue }))} />
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminAnalytics.topProducts}</h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.adminAnalytics.noSales}</p>
          ) : (
            <BarList items={stats.topProducts.map((product) => ({ label: product.name, value: product.soldCount, display: `${product.soldCount} ${t.adminAnalytics.soldSuffix}` }))} />
          )}
        </Card>
        <Card>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminDash.salesByWilaya}</h2>
          {stats.salesByWilaya.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.adminDash.noOrdersPeriod}</p>
          ) : (
            <BarList items={stats.salesByWilaya.map((entry) => ({ label: entry.wilaya, value: entry.total, display: formatDA(entry.total) }))} />
          )}
        </Card>
      </div>
    </div>
  );
}
