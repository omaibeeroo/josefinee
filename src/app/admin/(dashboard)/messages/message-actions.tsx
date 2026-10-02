"use client";

import { useRouter } from "next/navigation";
import { setMessageStatusAction } from "@/server/actions/admin-ops";
import type { ContactStatus } from "@prisma/client";

export function MessageActions({ id, status }: { id: string; status: ContactStatus }) {
  const router = useRouter();
  async function set(next: ContactStatus) {
    await setMessageStatusAction(id, next);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {status !== "IN_PROGRESS" && (
        <button type="button" onClick={() => void set("IN_PROGRESS")} className="underline underline-offset-2">
          In progress
        </button>
      )}
      {status !== "RESOLVED" && (
        <button type="button" onClick={() => void set("RESOLVED")} className="underline underline-offset-2">
          Resolve
        </button>
      )}
      {status !== "SPAM" && (
        <button type="button" onClick={() => void set("SPAM")} className="text-[#9e342e] underline underline-offset-2">
          Spam
        </button>
      )}
    </div>
  );
}
