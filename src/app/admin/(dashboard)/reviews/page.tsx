import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { listReviewsAdmin } from "@/server/actions/admin-catalog";
import { PageHeader } from "@/components/admin/ui";
import { ReviewActions, Stars } from "./review-actions";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("reviews:moderate");
  const params = await searchParams;
  const raw = params.status;
  const status = (Array.isArray(raw) ? raw[0] : raw) || "PENDING";
  const reviews = await listReviewsAdmin(status === "ALL" ? undefined : status);

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="All reviews require moderation before appearing on the store."
        action={
          <div className="flex gap-1 border hairline bg-white p-1" role="group" aria-label="Review status">
            {["PENDING", "APPROVED", "REJECTED", "ALL"].map((option) => (
              <Link
                key={option}
                href={`/admin/reviews?status=${option}`}
                aria-current={status === option ? "true" : undefined}
                className={`px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] ${
                  status === option ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink"
                }`}
              >
                {option}
              </Link>
            ))}
          </div>
        }
      />
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review.id} className="border hairline bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Stars value={review.rating} />
                <p className="mt-1 text-sm font-medium">
                  {review.title ? `${review.title} — ` : ""}
                  <Link href={`/products/${review.product.slug}`} target="_blank" className="underline underline-offset-2">
                    {review.product.name}
                  </Link>
                </p>
              </div>
              <ReviewActions id={review.id} />
            </div>
            <p className="mt-2 text-sm text-ink-soft">{review.body}</p>
            <p className="mt-2 text-xs text-ink-muted">
              {review.authorName} · {new Date(review.createdAt).toLocaleString("fr-DZ")}
              {review.isVerifiedPurchase ? " · Verified purchase" : ""}
            </p>
          </li>
        ))}
      </ul>
      {reviews.length === 0 && <p className="border hairline bg-white p-8 text-center text-sm text-ink-muted">Nothing here.</p>}
    </div>
  );
}
