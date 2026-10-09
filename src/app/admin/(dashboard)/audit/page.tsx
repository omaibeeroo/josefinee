import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listAuditLogs } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTimeFR } from "@/lib/money";

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
  const [result, t] = await Promise.all([listAuditLogs(filters), getDictionary()]);

  return (
    <div>
      <PageHeader title={t.adminPages.auditTitle} description={t.adminPages.auditDesc} />
      <form method="get" className="mb-4 flex flex-col gap-2 border hairline bg-white p-4 sm:flex-row">
        <input name="search" defaultValue={filters.search} placeholder={t.adminAuditTable.searchPh} className="field min-h-10 flex-1" aria-label={t.adminAuditTable.searchLabel} />
        <button type="submit" className="btn btn-primary min-h-10 px-6 text-xs">
          {t.adminAuditTable.search}
        </button>
      </form>
      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">{t.adminAuditTable.colWhen}</th>
              <th className="px-4 py-3">{t.adminAuditTable.colActor}</th>
              <th className="px-4 py-3">{t.adminAuditTable.colAction}</th>
              <th className="px-4 py-3">{t.adminAuditTable.colResource}</th>
              <th className="px-4 py-3">{t.adminAuditTable.colIp}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {formatDateTimeFR(entry.createdAt, t.locale)}
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
