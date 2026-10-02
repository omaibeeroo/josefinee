"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { archiveProductAction, setProductStatusAction } from "@/server/actions/admin-catalog";

export function ProductRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function archive() {
    if (!window.confirm("Archive or delete this product? Products with orders are archived, never hard-deleted.")) return;
    setPending(true);
    await archiveProductAction(id);
    setPending(false);
    router.refresh();
  }

  async function toggleActive() {
    setPending(true);
    await setProductStatusAction(id, status === "ACTIVE" ? "DRAFT" : "ACTIVE");
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-2 text-xs">
      <Link href={`/admin/products/${id}`} className="underline underline-offset-2">
        Edit
      </Link>
      <button type="button" disabled={pending} onClick={() => void toggleActive()} className="underline underline-offset-2 disabled:opacity-40">
        {status === "ACTIVE" ? "Unpublish" : "Publish"}
      </button>
      <button type="button" disabled={pending} onClick={() => void archive()} className="text-[#9e342e] underline underline-offset-2 disabled:opacity-40">
        Delete
      </button>
    </div>
  );
}
