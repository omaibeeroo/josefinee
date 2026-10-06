import Link from "next/link";
import Image from "next/image";
import { getCustomerOrders } from "@/server/actions/account";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDA } from "@/lib/money";
import { EmptyState } from "@/components/ui";

export default async function AccountOrdersPage() {
  const orders = await getCustomerOrders();

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Aucune commande pour l’instant"
        message="Vos commandes apparaîtront ici après votre première commande."
        action={
          <Link href="/shop" className="btn btn-primary">
            Découvrir la boutique
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
                {order.orderNumber}
              </Link>
              <p className="mt-0.5 text-xs text-ink-muted">
                {new Date(order.createdAt).toLocaleDateString("fr-DZ", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <span className="text-xs font-medium uppercase tracking-[0.14em]">
              {ORDER_STATUS_LABELS[order.status].label}
            </span>
            <p className="font-medium">{formatDA(order.total)}</p>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {order.items.slice(0, 6).map((item, index) => (
              <div key={index} className="relative h-14 w-12 shrink-0 overflow-hidden bg-cream" title={item.productName}>
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.productName} fill sizes="48px" className="object-cover" />
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
