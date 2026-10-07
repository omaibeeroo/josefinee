import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/server";
import { TrackForm } from "./track-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.track.title, robots: { index: false, follow: false } };
}

export default async function TrackPage() {
  const t = await getDictionary();
  return (
    <div className="container-luxe py-12 md:py-16">
      <div className="text-center">
        <p className="eyebrow mb-2">{t.track.eyebrow}</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">{t.track.title}</h1>
        <p className="mt-3 text-ink-soft">{t.track.hint}</p>
      </div>
      <TrackForm />
    </div>
  );
}
