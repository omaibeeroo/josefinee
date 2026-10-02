import { requirePermission } from "@/lib/auth/rbac";
import { listSubscribersAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { SubscriberActions } from "./subscriber-actions";

export const dynamic = "force-dynamic";

export default async function AdminNewsletterPage() {
  await requirePermission("dashboard:read");
  const subscribers = await listSubscribersAdmin();
  const active = subscribers.filter((entry) => !entry.unsubscribedAt);

  return (
    <div>
      <PageHeader
        title="Newsletter"
        description={`${active.length} active subscribers. Consent timestamps are stored for every signup.`}
        action={
          <a href="/api/admin/newsletter/export" className="btn btn-ghost min-h-10 px-4 text-xs">
            Export CSV
          </a>
        }
      />
      <div className="overflow-x-auto border hairline bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b hairline text-xs uppercase tracking-[0.1em] text-ink-muted">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Subscribed</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id}>
                <td className="px-4 py-3">{subscriber.email}</td>
                <td className="px-4 py-3 text-xs">{subscriber.source ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {new Date(subscriber.createdAt).toLocaleDateString("fr-DZ")}
                </td>
                <td className="px-4 py-3 text-xs">{subscriber.unsubscribedAt ? "Unsubscribed" : "Active"}</td>
                <td className="px-4 py-3 text-right">
                  <SubscriberActions id={subscriber.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subscribers.length === 0 && <p className="p-8 text-center text-sm text-ink-muted">No subscribers yet.</p>}
      </div>
    </div>
  );
}
