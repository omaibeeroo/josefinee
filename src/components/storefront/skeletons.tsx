/**
 * Server-rendered skeleton screens shown during route transitions.
 * They match the real layouts to eliminate layout shift (CLS).
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-sand/60 ${className}`} />;
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function CatalogLoading() {
  return (
    <div className="container-luxe py-10 md:py-14" aria-label="Loading products">
      <div className="mx-auto mb-8 max-w-md text-center">
        <Skeleton className="mx-auto h-3 w-24" />
        <Skeleton className="mx-auto mt-3 h-10 w-64" />
      </div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-40" />
      </div>
      <ProductGridSkeleton />
      <span className="sr-only" role="status">
        Loading products…
      </span>
    </div>
  );
}

export function ProductLoading() {
  return (
    <div className="container-luxe py-8 md:py-12" aria-label="Loading product">
      <Skeleton className="mb-6 h-3 w-56" />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Skeleton className="aspect-[3/4] w-full" />
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-10 w-4/5" />
          <Skeleton className="mt-4 h-7 w-40" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <Skeleton className="mt-6 h-[2.875rem] w-full" />
          <Skeleton className="mt-3 h-[2.875rem] w-full" />
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading product…
      </span>
    </div>
  );
}
