import Link from "next/link";
import { cn } from "@/lib/utils";

/** Server-rendered pagination — accepts a URL builder (no client JS needed). */
export function Pagination({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (entry) => entry === 1 || entry === totalPages || Math.abs(entry - page) <= 1,
  );
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className="btn btn-ghost min-h-10 px-4 text-xs">
          Previous
        </Link>
      )}
      {pages.map((entry) => (
        <Link
          key={entry}
          href={href(entry)}
          aria-current={entry === page ? "page" : undefined}
          className={cn(
            "flex min-h-10 min-w-10 items-center justify-center border px-3 text-sm",
            entry === page ? "border-ink bg-ink text-ivory" : "hairline bg-white",
          )}
        >
          {entry}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={href(page + 1)} className="btn btn-ghost min-h-10 px-4 text-xs">
          Next
        </Link>
      )}
    </nav>
  );
}
