import Link from "next/link";
import Image from "next/image";
import { getCustomerOrders } from "@/server/actions/account";
import { formatDA, formatDateFR } from "@/lib/money";
import { getDictionary } from "@/lib/i18n/server";
import { EmptyState } from "@/components/ui";

export default async function AccountOrdersPage() {
  const [orders, t] = await Promise.all([getCustomerOrders(), getDictionary()]);

  if (orders.length === 0) {
    return (
      <EmptyState
        title={t.account.noOrders}
        message={t.account.noOrdersHint}
        action={
          <Link href="/shop" className="btn btn-primary">
            {t.common.discoverShop}
          </Link>
        }
      />
    );
  }

  return (
    <ul className="space-y-4">
      {orders.map((order) => (
        <li key={order.orderNumber} className="border hairline bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href={`/order/${order.orderNumber}?t=${encodeURIComponent(order.trackingToken)}`}
                className="font-medium hover:underline"
              >
                <bdi>{order.orderNumber}</bdi>
              </Link>
              <p className="mt-0.5 text-xs text-ink-muted">
                {formatDateFR(order.createdAt, t.locale)}
              </p>
            </div>
            <span className="text-xs font-medium uppercase tracking-[0.14em]">
              {t.status[order.status]}
            </span>
            <p className="font-medium">{formatDA(order.total, t.locale)}</p>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {order.items.slice(0, 6).map((item, index) => (
              <div key={index} className="relative h-14 w-12 shrink-0 overflow-hidden bg-cream" title={item.productName}>
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.productName} fill sizes="48px" unoptimized className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display text-lg text-ink-muted">
                    {item.productName.charAt(0)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
