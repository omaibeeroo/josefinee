"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Headset, PackageCheck, Truck } from "lucide-react";
import { subscribeNewsletterAction } from "@/server/actions/engagement";
import { Accordion, Honeypot, Reveal } from "@/components/ui";
import type { HomepageSettings } from "@/lib/settings";
import type { StoreProductCard } from "@/server/catalog";

/* ------------------------------------------------------------------ Hero */

export function DiscoveryStrip() {
  const items = [
    { label: "Nouveautés", detail: "Les dernières pièces", href: "/collections/new-in" },
    { label: "Bestsellers", detail: "Les favoris du moment", href: "/collections/best-sellers" },
    { label: "Livraison", detail: "Partout en Algérie", href: "/pages/shipping" },
  ];

  return (
    <section className="border-b hairline bg-white" aria-label="Découvrir Josefinee">
      <div className="container-luxe grid divide-y hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((item, index) => (
          <Link
            key={item.label}
            href={item.href}
            className="group flex items-center justify-between gap-4 py-5 sm:px-6 md:py-6 first:sm:pl-0 last:sm:pr-0"
          >
            <span>
              <span className="block text-sm font-medium tracking-wide text-ink">{item.label}</span>
              <span className="mt-1 block text-xs text-ink-muted">{item.detail}</span>
            </span>
            <span
              className="font-display text-2xl text-gold transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            >
              0{index + 1}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Hero({ hero }: { hero: HomepageSettings["hero"] }) {
  const hasImage = Boolean(hero.imageDesktop);
  return (
    <section className="relative overflow-hidden bg-cream" aria-label="Featured">
      {hasImage ? (
        <>
          <div className="relative hidden aspect-[21/9] w-full md:block">
            <Image
              src={hero.imageDesktop}
              alt={hero.headline}
              fill
              priority
              sizes="100vw"
              className="object-cover motion-safe:animate-hero-image"
            />
          </div>
          <div className="relative aspect-[4/5] w-full sm:aspect-[16/10] md:hidden">
            <Image
              src={hero.imageMobile || hero.imageDesktop}
              alt={hero.headline}
              fill
              priority
              sizes="100vw"
              className="object-cover motion-safe:animate-hero-image"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 pb-10 md:pb-16">
            <div className="container-luxe text-ivory">
              <p
                className="eyebrow !text-ivory/80 motion-safe:animate-hero-enter opacity-0"
                style={{ animationDelay: "120ms" }}
              >
                {hero.eyebrow}
              </p>
              <h1
                className="mt-3 max-w-2xl font-display text-4xl font-medium leading-[1.05] motion-safe:animate-hero-enter opacity-0 md:text-6xl"
                style={{ animationDelay: "220ms" }}
              >
                {hero.headline}
              </h1>
              <p
                className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-ivory/85 motion-safe:animate-hero-enter opacity-0"
                style={{ animationDelay: "320ms" }}
              >
                {hero.subheading}
              </p>
              <div
                className="mt-6 flex flex-wrap gap-3 motion-safe:animate-hero-enter opacity-0"
                style={{ animationDelay: "420ms" }}
              >
                <Link
                  href={hero.primaryHref}
                  className="btn btn-shine bg-ivory text-ink hover:bg-white"
                >
                  {hero.primaryLabel}
                </Link>
                <Link
                  href={hero.secondaryHref}
                  className="btn border border-ivory/70 text-ivory hover:bg-ivory hover:text-ink"
                >
                  {hero.secondaryLabel}
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="container-luxe py-16 text-center md:py-28">
          <p
            className="eyebrow motion-safe:animate-hero-enter opacity-0"
            style={{ animationDelay: "120ms" }}
          >
            {hero.eyebrow}
          </p>
          <h1
            className="mx-auto mt-4 max-w-3xl font-display text-5xl font-medium leading-[1.05] motion-safe:animate-hero-enter opacity-0 md:text-7xl"
            style={{ animationDelay: "220ms" }}
          >
            {hero.headline}
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl text-ink-soft motion-safe:animate-hero-enter opacity-0"
            style={{ animationDelay: "320ms" }}
          >
            {hero.subheading}
          </p>
          <div
            className="mt-8 flex flex-wrap justify-center gap-3 motion-safe:animate-hero-enter opacity-0"
            style={{ animationDelay: "420ms" }}
          >
            <Link href={hero.primaryHref} className="btn btn-primary btn-shine">
              {hero.primaryLabel}
            </Link>
            <Link href={hero.secondaryHref} className="btn btn-outline">
              {hero.secondaryLabel}
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------ Featured block */

export function FeaturedCollection({
  title,
  description,
  image,
  href,
  cta,
}: {
  title: string;
  description: string;
  image: string | null;
  href: string;
  cta: string;
}) {
  return (
    <section className="container-luxe" aria-label={title}>
      <Reveal>
        <Link
          href={href}
          className="group relative block overflow-hidden bg-cream transition-transform duration-500 hover:-translate-y-1"
        >
          <div className="relative aspect-[16/10] w-full md:aspect-[21/8]">
            {image ? (
              <Image
                src={image}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                className="editorial-image object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-display text-6xl text-ink-muted/50 md:text-8xl">
                  {title.charAt(0)}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-6 text-ivory md:p-10">
              <p className="eyebrow !text-ivory/80">Collection à découvrir</p>
              <h2 className="font-display text-4xl font-medium md:text-5xl">{title}</h2>
              <p className="max-w-lg text-sm text-ivory/85 md:text-base">{description}</p>
              <span className="btn mt-3 bg-ivory text-ink group-hover:bg-white">
                {cta} <ArrowRight size={15} />
              </span>
            </div>
          </div>
        </Link>
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------- Category grid */

export type CategoryTile = { name: string; slug: string; image: string | null; count: number };

export function CategoryGrid({ categories }: { categories: CategoryTile[] }) {
  if (categories.length === 0) return null;
  return (
    <section className="container-luxe" aria-label="Acheter par catégorie">
      <Reveal>
        <div className="mb-6 flex items-end justify-between gap-6 md:mb-8">
          <div>
            <p className="eyebrow mb-2">Pour vous</p>
            <h2 className="font-display text-3xl font-medium md:text-4xl">Acheter par catégorie</h2>
          </div>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-ink-muted sm:block">
            The Josefinee wardrobe
          </span>
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {categories.slice(0, 6).map((category, index) => (
          <Reveal key={category.slug} delay={Math.min(index, 5) * 70}>
            <Link
              href={`/categories/${category.slug}`}
              className="group relative block overflow-hidden bg-cream transition-transform duration-500 hover:-translate-y-1"
            >
              <div className="relative aspect-[3/4] w-full">
                {category.image ? (
                  <Image
                    src={category.image}
                    alt={category.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 16vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display text-5xl text-ink-muted/60">
                    {category.name.charAt(0)}
                  </span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-ivory md:p-4">
                  <p className="text-sm font-medium md:text-base">{category.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[0.6875rem] uppercase tracking-[0.16em] text-ivory/80">
                    Découvrir <ArrowRight size={12} />
                  </p>
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Trust bar */

const TRUST_ITEMS = [
  { icon: Truck, title: "Livraison rapide", text: "Dans les 58 wilayas" },
  { icon: PackageCheck, title: "Paiement à la livraison", text: "Réglez à la réception" },
  { icon: Headset, title: "Emballage soigné", text: "Vérifié et préparé à la main" },
];

export function TrustBar() {
  return (
    <section className="border-y hairline bg-white" aria-label="Pourquoi choisir notre boutique">
      <div className="motion-stagger container-luxe grid grid-cols-1 gap-6 py-8 sm:grid-cols-3">
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} className="group flex items-center gap-4">
            <span className="trust-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream">
              <item.icon size={20} strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.1em]">{item.title}</p>
              <p className="text-sm text-ink-soft">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SocialProof({ deliveredCount }: { deliveredCount: number }) {
  if (deliveredCount <= 0) return null;
  return (
    <section className="bg-ink text-ivory" aria-label="La confiance de nos clientes">
      <div className="container-luxe flex flex-col items-center gap-2 py-10 text-center md:py-14">
        <p className="font-display text-5xl font-medium md:text-6xl">
          +{deliveredCount.toLocaleString("fr-FR")}
        </p>
        <p className="text-xs uppercase tracking-[0.24em] text-ivory/70">
          Commandes livrées avec succès
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Pillars */

export function Pillars({ items }: { items: Array<{ title: string; text: string }> }) {
  if (items.length === 0) return null;
  return (
    <section className="container-luxe" aria-label="Nos engagements">
      <div className="grid gap-8 md:grid-cols-3">
        {items.map((item, index) => (
          <Reveal key={item.title} delay={index * 90}>
            <div className="border-t-2 border-gold pt-5">
              <p className="font-display text-lg text-gold-dark">0{index + 1}</p>
              <h3 className="mt-2 font-display text-2xl">{item.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{item.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Editorial block */

export function Editorial({
  image,
  eyebrow,
  title,
  text,
  href,
  cta,
}: {
  image: string | null;
  eyebrow: string;
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <section className="container-luxe" aria-label={title}>
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
        <Reveal>
          <div className="relative aspect-[4/5] overflow-hidden bg-cream">
            {image ? (
              <Image
                src={image}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="editorial-image object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-display text-8xl text-ink-muted/50">
                {title.charAt(0)}
              </span>
            )}
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="mt-3 font-display text-3xl font-medium md:text-5xl">{title}</h2>
            <p className="mt-4 leading-relaxed text-ink-soft">{text}</p>
            <Link href={href} className="btn btn-outline mt-7">
              {cta}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ FAQ teaser */

export function FaqTeaser({ items }: { items: Array<{ question: string; answer: string }> }) {
  if (items.length === 0) return null;
  return (
    <section className="container-luxe max-w-3xl" aria-label="Questions fréquentes">
      <Reveal>
        <div className="mb-6 text-center">
          <p className="eyebrow mb-2">À savoir</p>
          <h2 className="font-display text-3xl font-medium md:text-4xl">
            Vos questions, nos réponses
          </h2>
        </div>
      </Reveal>
      <Reveal delay={100}>
        <Accordion
          items={items.map((item) => ({
            title: item.question,
            content: <p className="rich-text">{item.answer}</p>,
          }))}
        />
      </Reveal>
      <div className="mt-6 text-center">
        <Link
          href="/faq"
          className="text-xs font-medium uppercase tracking-[0.24em] underline underline-offset-8"
        >
          Voir toutes les questions
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Newsletter */

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await subscribeNewsletterAction(email, "homepage", website);
    setState({ ok: result.ok, message: result.ok ? result.message : result.error });
    if (result.ok) setEmail("");
    setPending(false);
  }

  return (
    <section className="container-luxe" aria-label="Newsletter">
      <Reveal>
        <div className="border-y hairline bg-cream/60 px-6 py-14 text-center md:py-20">
          <p className="eyebrow">Restez informée</p>
          <h2 className="mx-auto mt-2 max-w-xl font-display text-3xl font-medium md:text-4xl">
            Nouveautés, ventes privées et inspirations
          </h2>
          <form
            onSubmit={submit}
            className="relative mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row"
          >
            <Honeypot value={website} onChange={setWebsite} />
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Votre adresse e-mail"
              aria-label="Adresse e-mail"
              className="field"
            />
            <button type="submit" disabled={pending} className="btn btn-primary btn-shine shrink-0">
              {pending ? "…" : "S’inscrire"}
            </button>
          </form>
          {state && (
            <p className={`mt-3 text-sm ${state.ok ? "text-ink-soft" : "text-sale"}`} role="status">
              {state.message}
            </p>
          )}
        </div>
      </Reveal>
    </section>
  );
}

export type { StoreProductCard };
