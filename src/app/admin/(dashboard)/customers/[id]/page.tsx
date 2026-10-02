import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { getCustomerDetail } from "@/server/actions/admin-ops";
import { Card, OrderStatusBadge, PageHeader, RiskBadge } from "@/components/admin/ui";
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
  const customer = await getCustomerDetail(id).catch(() => null);
  if (!customer) notFound();

  return (
    <div>
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        action={<RiskBadge level={customer.riskLevel} />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em]">Profile</h2>
          <p className="text-sm">{formatPhoneDisplay(customer.phone)}</p>
          {customer.email && <p className="text-sm">{customer.email}</p>}
          <p className="mt-2 text-xs uppercase tracking-[0.1em] text-ink-muted">{customer.status}</p>
          <h3 className="mb-2 mt-5 text-sm font-medium uppercase tracking-[0.14em]">Addresses</h3>
          {customer.addresses.length === 0 ? (
            <p className="text-sm text-ink-muted">No saved addresses.</p>
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
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em]">Orders ({customer.orders.length})</h2>
            <ul className="divide-y divide-line">
              {customer.orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                    {order.orderNumber}
                  </Link>
                  <OrderStatusBadge status={order.status} />
                  <span className="tabular-nums">{formatDA(order.total)}</span>
                </li>
              ))}
            </ul>
            {customer.orders.length === 0 && <p className="text-sm text-ink-muted">No orders yet.</p>}
          </Card>
          <Card>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.14em]">Internal</h2>
            <CustomerForms id={customer.id} notes={customer.riskNotes} status={customer.status} />
          </Card>
        </div>
      </div>
    </div>
  );
}
