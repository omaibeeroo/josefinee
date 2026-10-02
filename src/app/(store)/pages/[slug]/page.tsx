import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cleanRichText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const getPage = cache((slug: string) =>
  prisma.page.findFirst({
      where: { slug, isPublished: true },
      select: { title: true, content: true, seoTitle: true, seoDescription: true },
    }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  const title = page.seoTitle || page.title;
  const description = page.seoDescription || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/pages/${slug}` },
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <div className="container-luxe max-w-3xl py-12 md:py-16">
      <h1 className="font-display text-4xl font-medium md:text-5xl">{page.title}</h1>
      <div className="rich-text mt-8" dangerouslySetInnerHTML={{ __html: cleanRichText(page.content) }} />
    </div>
  );
}
