import Link from "next/link";
import { getAccountOverview } from "@/server/actions/account";
import { formatDA, formatDateFR } from "@/lib/money";
import { getDictionary } from "@/lib/i18n/server";

export default async function AccountOverviewPage() {
  const [overview, t] = await Promise.all([getAccountOverview(), getDictionary()]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="border hairline bg-white p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">{t.account.orders}</p>
        <p className="mt-2 font-display text-4xl">{overview.orderCount}</p>
        <Link href="/account/orders" className="mt-3 inline-block text-xs uppercase tracking-[0.16em] underline underline-offset-4">
          {t.common.viewAll}
        </Link>
      </div>
      <div className="border hairline bg-white p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">{t.account.wishlist}</p>
        <p className="mt-2 font-display text-4xl">{overview.wishlistCount}</p>
        <Link href="/account/wishlist" className="mt-3 inline-block text-xs uppercase tracking-[0.16em] underline underline-offset-4">
          {t.account.viewSaved}
        </Link>
      </div>
      <div className="border hairline bg-white p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">{t.account.profile}</p>
        <p className="mt-2 font-medium">
          {overview.customer.firstName} {overview.customer.lastName}
        </p>
        <p className="text-sm text-ink-soft">{overview.customer.phone}</p>
        {overview.customer.email && <p className="text-sm text-ink-soft">{overview.customer.email}</p>}
      </div>

      {overview.latestOrders.length > 0 && (
        <div className="border hairline bg-white p-6 md:col-span-3">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">{t.account.recentOrders}</p>
          <ul className="mt-4 divide-y divide-line">
            {overview.latestOrders.map((order) => (
              <li key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <Link
                    href={`/order/${order.orderNumber}?t=${encodeURIComponent(order.trackingToken)}`}
                    className="font-medium hover:underline"
                  >
                    <bdi>{order.orderNumber}</bdi>
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {formatDateFR(order.createdAt, t.locale)} · {t.status[order.status]}
                  </p>
                </div>
                <p className="font-medium">{formatDA(order.total, t.locale)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
