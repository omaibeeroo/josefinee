import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listCustomersAdmin } from "@/server/actions/admin-ops";
import { PageHeader, RiskBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("customers:read");
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const filters = {
    search: pick(params.search) || undefined,
    page: pick(params.page) ? Number.parseInt(pick(params.page), 10) || 1 : 1,
  };
  const result = await listCustomersAdmin(filters);

  return (
    <div>
      <PageHeader title="Customers" description={`${result.total} customers. Personal data is only visible to authorized staff.`} />
      <form method="get" className="mb-4 flex gap-2 border hairline bg-white p-4">
        <input name="search" defaultValue={filters.search} placeholder="Phone, email, name…" className="field min-h-10 flex-1" aria-label="Search customers" />
        <button type="submit" className="btn btn-primary min-h-10 px-6 text-xs">
          Search
        </button>
      </form>
      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Last order</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((customer) => (
              <tr key={customer.id} className="hover:bg-cream/60">
                <td className="px-4 py-3">
                  <Link href={`/admin/customers/${customer.id}`} className="font-medium hover:underline">
                    {customer.firstName} {customer.lastName}
                  </Link>
                  <span className="block text-xs text-ink-muted">{customer.email ?? "no email"}</span>
                </td>
                <td className="px-4 py-3">{customer.phone}</td>
                <td className="px-4 py-3 tabular-nums">{customer._count.orders}</td>
                <td className="px-4 py-3">
                  <RiskBadge level={customer.riskLevel} />
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("fr-DZ") : "—"}
                </td>
                <td className="px-4 py-3 text-xs uppercase tracking-[0.1em]">{customer.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">No customers found.</p>}
      </div>
    </div>
  );
}
