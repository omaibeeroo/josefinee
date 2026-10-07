import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n/server";
import { Accordion } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.faq.title, description: t.faq.description };
}

export default async function FaqPage() {
  const t = await getDictionary();
  const items = await prisma.faqItem
    .findMany({
      where: { isPublished: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, category: true, question: true, answer: true },
    })
    .catch(() => []);

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }

  return (
    <div className="container-luxe max-w-3xl py-12 md:py-16">
      <div className="mb-10 text-center">
        <p className="eyebrow mb-2">{t.faq.eyebrow}</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">{t.faq.title}</h1>
      </div>
      {[...groups.entries()].map(([category, list]) => (
        <section key={category} className="mb-10" aria-label={category}>
          <h2 className="mb-4 font-display text-2xl">{category}</h2>
          <Accordion
            items={list.map((item) => ({
              title: item.question,
              content: <p className="rich-text">{item.answer}</p>,
            }))}
          />
        </section>
      ))}
      {items.length === 0 && (
        <p className="text-center text-ink-soft">{t.faq.empty}</p>
      )}
    </div>
  );
}
