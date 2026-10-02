import { NextResponse } from "next/server";
import { appUrl } from "@/config/brand";
import { generateSitemaps } from "../sitemap";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function GET(): Promise<NextResponse> {
  const base = appUrl();
  let partitions: Awaited<ReturnType<typeof generateSitemaps>>;
  try {
    partitions = await generateSitemaps();
  } catch (error) {
    console.error(
      "[sitemap-index] dynamic sitemap discovery failed",
      error instanceof Error ? error.name : "unknown",
    );
    partitions = [{ id: "fixed" }];
  }
  const entries = partitions
    .map(({ id }) => `<sitemap><loc>${escapeXml(`${base}/sitemap/${encodeURIComponent(String(id))}.xml`)}</loc></sitemap>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
