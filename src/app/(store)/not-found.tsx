import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-luxe py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-display text-5xl">Cette page n’existe pas</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        La page que vous cherchez a peut-être été déplacée ou n’existe plus.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Retour à l’accueil
      </Link>
    </div>
  );
}
