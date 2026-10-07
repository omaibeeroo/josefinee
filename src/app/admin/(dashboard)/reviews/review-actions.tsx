"use client";

import { useRouter } from "next/navigation";
import { deleteReviewAction, moderateReviewAction } from "@/server/actions/admin-catalog";
import { Stars } from "@/components/ui";
import { useLocale } from "@/lib/i18n/provider";

export function ReviewActions({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useLocale();
  return (
    <div className="flex gap-2 text-xs">
      <button
        type="button"
        onClick={() => moderateReviewAction(id, "APPROVED").then(() => router.refresh())}
        className="underline underline-offset-2"
      >
        {t.adminRow.approve}
      </button>
      <button
        type="button"
        onClick={() => moderateReviewAction(id, "REJECTED").then(() => router.refresh())}
        className="underline underline-offset-2"
      >
        {t.adminRow.reject}
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(t.adminRow.deleteReview)) void deleteReviewAction(id).then(() => router.refresh());
        }}
        className="text-[#9e342e] underline underline-offset-2"
      >
        {t.adminForm.delete}
      </button>
    </div>
  );
}

export { Stars };
