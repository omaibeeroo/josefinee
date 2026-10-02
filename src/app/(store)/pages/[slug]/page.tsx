import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getPage(slug: string) {
  return prisma.page
    .findFirst({
      where: { slug, isPublished: true },
      select: { title: true, content: true, seoTitle: true, seoDescription: true },
    })
    .catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Page" };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
  };
}

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <div className="container-luxe max-w-3xl py-12 md:py-16">
      <h1 className="font-display text-4xl font-medium md:text-5xl">{page.title}</h1>
      <div className="rich-text mt-8" dangerouslySetInnerHTML={{ __html: page.content }} />
    </div>
  );
}
