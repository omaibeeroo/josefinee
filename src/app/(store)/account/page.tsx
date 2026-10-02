import Link from "next/link";
import { getAccountOverview } from "@/server/actions/account";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDA } from "@/lib/money";

export default async function AccountOverviewPage() {
  const overview = await getAccountOverview();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="border hairline bg-white p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Orders</p>
        <p className="mt-2 font-display text-4xl">{overview.orderCount}</p>
        <Link href="/account/orders" className="mt-3 inline-block text-xs uppercase tracking-[0.16em] underline underline-offset-4">
          View all
        </Link>
      </div>
      <div className="border hairline bg-white p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Wishlist</p>
        <p className="mt-2 font-display text-4xl">{overview.wishlistCount}</p>
        <Link href="/account/wishlist" className="mt-3 inline-block text-xs uppercase tracking-[0.16em] underline underline-offset-4">
          View saved
        </Link>
      </div>
      <div className="border hairline bg-white p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Profile</p>
        <p className="mt-2 font-medium">
          {overview.customer.firstName} {overview.customer.lastName}
        </p>
        <p className="text-sm text-ink-soft">{overview.customer.phone}</p>
        {overview.customer.email && <p className="text-sm text-ink-soft">{overview.customer.email}</p>}
      </div>

      {overview.latestOrders.length > 0 && (
        <div className="border hairline bg-white p-6 md:col-span-3">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">Recent orders</p>
          <ul className="mt-4 divide-y divide-line">
            {overview.latestOrders.map((order) => (
              <li key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <Link
                    href={`/order/${order.orderNumber}?t=${encodeURIComponent(order.trackingToken)}`}
                    className="font-medium hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="text-xs text-ink-muted">
                    {new Date(order.createdAt).toLocaleDateString("fr-DZ")} · {ORDER_STATUS_LABELS[order.status].label}
                  </p>
                </div>
                <p className="font-medium">{formatDA(order.total)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
