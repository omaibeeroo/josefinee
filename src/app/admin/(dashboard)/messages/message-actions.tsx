"use client";

import { useRouter } from "next/navigation";
import { setMessageStatusAction } from "@/server/actions/admin-ops";
import { useLocale } from "@/lib/i18n/provider";
import type { ContactStatus } from "@prisma/client";

export function MessageActions({ id, status }: { id: string; status: ContactStatus }) {
  const router = useRouter();
  const { t } = useLocale();
  async function set(next: ContactStatus) {
    await setMessageStatusAction(id, next);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {status !== "IN_PROGRESS" && (
        <button type="button" onClick={() => void set("IN_PROGRESS")} className="underline underline-offset-2">
          {t.adminRow.inProgress}
        </button>
      )}
      {status !== "RESOLVED" && (
        <button type="button" onClick={() => void set("RESOLVED")} className="underline underline-offset-2">
          {t.adminRow.resolve}
        </button>
      )}
      {status !== "SPAM" && (
        <button type="button" onClick={() => void set("SPAM")} className="text-[#9e342e] underline underline-offset-2">
          {t.adminPages.tabSpam}
        </button>
      )}
    </div>
  );
}
