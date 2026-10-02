"use client";

import { useRouter } from "next/navigation";
import { deleteReviewAction, moderateReviewAction } from "@/server/actions/admin-catalog";
import { Stars } from "@/components/ui";

export function ReviewActions({ id }: { id: string }) {
  const router = useRouter();
  return (
    <div className="flex gap-2 text-xs">
      <button
        type="button"
        onClick={() => moderateReviewAction(id, "APPROVED").then(() => router.refresh())}
        className="underline underline-offset-2"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => moderateReviewAction(id, "REJECTED").then(() => router.refresh())}
        className="underline underline-offset-2"
      >
        Reject
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Delete this review?")) void deleteReviewAction(id).then(() => router.refresh());
        }}
        className="text-[#9e342e] underline underline-offset-2"
      >
        Delete
      </button>
    </div>
  );
}

export { Stars };
