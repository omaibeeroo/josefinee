import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { getAdminOrder } from "@/server/actions/admin-orders";
import { allowedNextStatuses } from "@/server/order-transitions";
import { Card, OrderStatusBadge, PageHeader, RiskBadge } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";

import { formatDA, formatDateTimeFR } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import { NotesEditor, StatusChanger } from "./order-forms";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("orders:read");
  const { id } = await params;
  const [order, t] = await Promise.all([getAdminOrder(id).catch(() => null), getDictionary()]);
  if (!order) notFound();

  return (
    <div>
      <PageHeader
        title={order.orderNumber}
        description={`${t.adminOrderDetail.orderPlacedOn.replace("{date}", formatDateTimeFR(order.placedAt, t.locale))} · IP ${order.ip ?? "—"}`}
        action={
          <div className="flex gap-2">
            <OrderStatusBadge status={order.status} label={t.status[order.status]} />
            <RiskBadge level={order.riskLevel} />
            <Link href={`/admin/orders/${order.id}/print`} target="_blank" className="btn btn-ghost min-h-10 px-4 text-xs print:hidden">
              {t.admin.printSlip}
            </Link>
          </div>
        }
      />

      {order.riskLevel !== "LOW" && (
        <div className="mb-4 border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">{t.adminOrderDetail.riskReview.replace("{score}", String(order.riskScore))}</p>
          {order.riskFlags.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-ink-soft">
              {order.riskFlags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminOrderDetail.orderItems}</h2>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3">
                  <div className="relative h-16 w-14 shrink-0 overflow-hidden bg-cream">
                    {item.displayImageUrl && (
                      <Image src={item.displayImageUrl} alt={item.productName} fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-ink-muted">
                      {item.variantLabel ? `${item.variantLabel} · ` : ""}
                      {item.sku ?? t.adminOrderDetail.noSku} · {t.adminOrderDetail.qty} {item.quantity}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="tabular-nums">{formatDA(item.unitPrice)} × {item.quantity}</p>
                    <p className="font-medium tabular-nums">{formatDA(item.lineTotal)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t hairline pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t.adminOrderDetail.subtotal}</dt>
                <dd className="tabular-nums">{formatDA(order.subtotal)}</dd>
              </div>
              {order.promotionDiscount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-soft">{t.adminOrderDetail.promotion}{order.promotion ? ` (${order.promotion.name})` : ""}</dt>
                  <dd className="tabular-nums">−{formatDA(order.promotionDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t.adminOrderDetail.discount}{order.coupon ? ` (${order.coupon.code})` : ""}</dt>
                <dd className="tabular-nums">−{formatDA(order.discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">{t.adminOrderDetail.delivery}</dt>
                <dd className="tabular-nums">{formatDA(order.shipping)}</dd>
              </div>
              <div className="flex justify-between text-base font-medium">
                <dt>{t.adminOrderDetail.total}</dt>
                <dd className="tabular-nums">{formatDA(order.total)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminOrderDetail.statusHistory}</h2>
            <ol className="space-y-3">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <OrderStatusBadge status={entry.status} label={t.status[entry.status]} />
                  <span className="text-xs text-ink-muted">
                    {formatDateTimeFR(entry.createdAt, t.locale)}
                    {entry.changedByUser ? ` · ${entry.changedByUser.name}` : ""}
                  </span>
                  {entry.note && <p className="w-full text-ink-soft">{entry.note}</p>}
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.14em]">{t.adminOrderDetail.notifications}</h2>
            {order.notifications.length === 0 ? (
              <p className="text-sm text-ink-muted">{t.adminOrderDetail.noNotifications}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {order.notifications.map((notification) => (
                  <li key={notification.id} className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="font-medium">{notification.channel}</span>
                    <span className="text-ink-muted">{notification.template}</span>
                    <span className={notification.status === "SENT" ? "text-emerald-700" : "text-[#9e342e]"}>
                      {notification.status}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {formatDateTimeFR(notification.createdAt, t.locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em]">{t.adminOrderDetail.customer}</h2>
            <p className="font-medium">
              {order.firstName} {order.lastName}
            </p>
            <p className="text-sm">{formatPhoneDisplay(order.phone)}</p>
            {order.email && <p className="text-sm">{order.email}</p>}
            <p className="mt-2 text-sm text-ink-soft">
              {order.address}
              <br />
              {order.communeName}, {order.wilayaName}
            </p>
            {order.notes && <p className="mt-2 text-sm italic text-ink-soft">“{order.notes}”</p>}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em]">{t.adminOrderDetail.changeStatus}</h2>
            <StatusChanger orderId={order.id} current={order.status} allowed={allowedNextStatuses(order.status)} />
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em]">{t.adminOrderDetail.internal}</h2>
            <NotesEditor orderId={order.id} initial={order.adminNotes} />
            <p className="mt-3 text-xs text-ink-muted">
              {t.adminOrderDetail.current}: {t.status[order.status]} · {order.paymentMethod} · {t.delivery[order.deliveryMethod]}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
