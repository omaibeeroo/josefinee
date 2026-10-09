import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { getCustomerDetail } from "@/server/actions/admin-ops";
import { Card, OrderStatusBadge, PageHeader, RiskBadge } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { formatDA } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import { CustomerForms } from "./customer-forms";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("customers:read");
  const { id } = await params;
  const [customer, t] = await Promise.all([getCustomerDetail(id).catch(() => null), getDictionary()]);
  if (!customer) notFound();

  return (
    <div>
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        action={<RiskBadge level={customer.riskLevel} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em]">{t.adminCustomer.profile}</h2>
          <p className="text-sm"><bdi>{formatPhoneDisplay(customer.phone)}</bdi></p>
          {customer.email && <p className="text-sm">{customer.email}</p>}
          <p className="mt-2 text-xs uppercase tracking-[0.1em] text-ink-muted">{customer.status}</p>
          <h3 className="mb-2 mt-5 text-sm font-medium uppercase tracking-[0.14em]">{t.adminCustomer.addresses}</h3>
          {customer.addresses.length === 0 ? (
            <p className="text-sm text-ink-muted">{t.adminCustomer.noAddresses}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {customer.addresses.map((address) => (
                <li key={address.id} className="border hairline p-3">
                  {address.address}, {address.commune.name}, {address.wilaya.name}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em]">{t.adminCustomer.orders} ({customer.orders.length})</h2>
            <ul className="divide-y divide-line">
              {customer.orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                    <bdi>{order.orderNumber}</bdi>
                  </Link>
                  <OrderStatusBadge status={order.status} label={t.status[order.status]} />
                  <span className="tabular-nums">{formatDA(order.total, t.locale)}</span>
                </li>
              ))}
            </ul>
            {customer.orders.length === 0 && <p className="text-sm text-ink-muted">{t.adminCustomer.noOrders}</p>}
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em]">{t.adminCustomer.internal}</h2>
            <CustomerForms id={customer.id} notes={customer.riskNotes} status={customer.status} />
          </Card>
        </div>
      </div>
    </div>
  );
}
