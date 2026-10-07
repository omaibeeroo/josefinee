"use client";

import { useRouter } from "next/navigation";
import { deleteSubscriberAction } from "@/server/actions/admin-ops";
import { useLocale } from "@/lib/i18n/provider";

export function SubscriberActions({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(t.adminRow.removeSubscriber)) void deleteSubscriberAction(id).then(() => router.refresh());
      }}
      className="text-xs text-[#9e342e] underline underline-offset-2"
    >
      {t.adminRow.remove}
    </button>
  );
}
