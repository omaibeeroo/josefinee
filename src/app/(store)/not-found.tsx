import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-luxe py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-display text-5xl">This page is not here</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        The page you are looking for may have been moved or no longer exists.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Back to home
      </Link>
    </div>
  );
}
