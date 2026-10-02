import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listMessagesAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { MessageActions } from "./message-actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "SPAM", "ALL"];

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("messages:read");
  const params = await searchParams;
  const raw = params.status;
  const status = (Array.isArray(raw) ? raw[0] : raw) || "NEW";
  const messages = await listMessagesAdmin(status === "ALL" ? undefined : status);

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Contact-form submissions with spam protection."
        action={
          <div className="flex gap-1 border hairline bg-white p-1" role="group" aria-label="Message status">
            {STATUSES.map((option) => (
              <Link
                key={option}
                href={`/admin/messages?status=${option}`}
                aria-current={status === option ? "true" : undefined}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em]",
                  status === option ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink",
                )}
              >
                {option}
              </Link>
            ))}
          </div>
        }
      />
      <ul className="space-y-3">
        {messages.map((message) => (
          <li key={message.id} className="border hairline bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {message.subject}
                <span className="ml-2 text-xs font-normal text-ink-muted">
                  {message.name} · {message.email}
                  {message.phone ? ` · ${message.phone}` : ""} · {new Date(message.createdAt).toLocaleString("fr-DZ")}
                </span>
              </p>
              <MessageActions id={message.id} status={message.status} />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{message.message}</p>
          </li>
        ))}
      </ul>
      {messages.length === 0 && <p className="border hairline bg-white p-8 text-center text-sm text-ink-muted">Nothing here.</p>}
    </div>
  );
}
