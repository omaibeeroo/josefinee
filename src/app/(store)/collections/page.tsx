import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Collections",
  description: "Découvrez nos collections de vêtements, bijoux et accessoires.",
};

export default async function CollectionsPage() {
  const collections = await prisma.collection.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, slug: true, description: true, image: true },
  });

  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="mb-10 text-center">
        <p className="eyebrow mb-2">Sélections exclusives</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Nos collections</h1>
      </div>
      {collections.length === 0 ? (
        <EmptyState
          title="Aucune collection pour le moment"
          message="Découvrez toutes nos pièces dans la boutique."
          action={<Link href="/shop" className="btn btn-primary">Voir la boutique</Link>}
        />
      ) : (
      <div className="grid gap-5 md:grid-cols-2">
        {collections.map((collection) => (
          <Link
            key={collection.slug}
            href={`/collections/${collection.slug}`}
            className="group relative block overflow-hidden bg-cream"
          >
            <div className="relative aspect-[16/9] w-full">
              {collection.image ? (
                <Image
                  src={collection.image}
                  alt={collection.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-7xl text-ink-muted/50">
                  {collection.name.charAt(0)}
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/55 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-ivory">
                <h2 className="font-display text-3xl">{collection.name}</h2>
                {collection.description && (
                  <p className="mt-1 max-w-md text-sm text-ivory/85">{collection.description}</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
      )}
    </div>
  );
}
