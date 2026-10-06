import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listAuditLogs } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("audit:read");
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const filters = {
    action: pick(params.action) || undefined,
    search: pick(params.search) || undefined,
    page: pick(params.page) ? Number.parseInt(pick(params.page), 10) || 1 : 1,
  };
  const result = await listAuditLogs(filters);

  return (
    <div>
      <PageHeader title="Journal d’audit" description="Registre immuable des actions admin importantes. Les entrées ne sont ni modifiées ni supprimées." />
      <form method="get" className="mb-4 flex flex-col gap-2 border hairline bg-white p-4 sm:flex-row">
        <input name="search" defaultValue={filters.search} placeholder="Action or resource ID…" className="field min-h-10 flex-1" aria-label="Search audit log" />
        <button type="submit" className="btn btn-primary min-h-10 px-6 text-xs">
          Search
        </button>
      </form>
      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {new Date(entry.createdAt).toLocaleString("fr-DZ")}
                </td>
                <td className="px-4 py-3 text-xs">
                  {entry.actor ? `${entry.actor.name} (${entry.actor.email})` : entry.actorType}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
                <td className="px-4 py-3 text-xs">
                  {entry.resource}
                  {entry.resourceId ? ` · ${entry.resourceId.slice(0, 12)}…` : ""}
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">{entry.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">No entries.</p>}
      </div>
      {result.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {result.page > 1 && (
            <Link href={`/admin/audit?page=${result.page - 1}`} className="btn btn-ghost min-h-10 px-4 text-xs">
              Previous
            </Link>
          )}
          <span className="text-ink-muted">
            Page {result.page} of {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={`/admin/audit?page=${result.page + 1}`} className="btn btn-ghost min-h-10 px-4 text-xs">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
