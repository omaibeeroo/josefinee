import { can, requirePermission } from "@/lib/auth/rbac";
import { listSubscribersAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateFR } from "@/lib/money";
import { SubscriberActions } from "./subscriber-actions";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  const user = await requirePermission("newsletter:read");
  const [subscribers, t] = await Promise.all([listSubscribersAdmin(), getDictionary()]);
  const active = subscribers.filter((entry) => !entry.unsubscribedAt);

  return (
    <div>
      <PageHeader
        title={t.adminPages.newsletterTitle}
        description={t.adminPages.newsletterDesc.replace("{total}", String(active.length))}
        action={can(user, "newsletter:export") ? (
          <a href="/api/admin/newsletter/export" className="btn btn-ghost min-h-10 px-4 text-xs">
            {t.adminPages.exportCsv}
          </a>
        ) : undefined}
      />
      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">{t.adminNewsletterTable.colEmail}</th>
              <th className="px-4 py-3">{t.adminNewsletterTable.colSource}</th>
              <th className="px-4 py-3">{t.adminNewsletterTable.colSubscribed}</th>
              <th className="px-4 py-3">{t.adminNewsletterTable.colStatus}</th>
              <th className="px-4 py-3 text-end">{t.adminNewsletterTable.colActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id}>
                <td className="px-4 py-3">{subscriber.email}</td>
                <td className="px-4 py-3 text-xs">{subscriber.source ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {formatDateFR(subscriber.createdAt, t.locale)}
                </td>
                <td className="px-4 py-3 text-xs">{subscriber.unsubscribedAt ? t.adminNewsletterTable.unsubscribed : t.adminNewsletterTable.active}</td>
                <td className="px-4 py-3 text-end">
                  <SubscriberActions id={subscriber.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subscribers.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">{t.adminNewsletterTable.empty}</p>}
      </div>
    </div>
  );
}
