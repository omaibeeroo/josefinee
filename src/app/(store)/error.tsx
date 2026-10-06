"use client";

import Link from "next/link";

export default function StoreError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-luxe py-24 text-center">
      <p className="eyebrow">Un problème est survenu</p>
      <h1 className="mt-3 font-display text-4xl">Veuillez réessayer</h1>
      <p className="mx-auto mt-4 max-w-md text-ink-soft">
        Une erreur inattendue s’est produite. Votre panier est en sécurité — rechargez cette page.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={() => reset()} className="btn btn-primary">
          Réessayer
        </button>
        <Link href="/" className="btn btn-ghost">
          Retour à l’accueil
        </Link>
      </div>
    </div>
  );
}
