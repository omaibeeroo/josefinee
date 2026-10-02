"use client";

import { useRouter } from "next/navigation";
import { deleteSubscriberAction } from "@/server/actions/admin-ops";

export function SubscriberActions({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("Remove this subscriber?")) void deleteSubscriberAction(id).then(() => router.refresh());
      }}
      className="text-xs text-[#9e342e] underline underline-offset-2"
    >
      Remove
    </button>
  );
}
