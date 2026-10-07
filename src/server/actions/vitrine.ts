"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/rbac";
import { recordAudit } from "@/lib/audit";
import { getSettings, updateSettingsSection, HOMEPAGE_SECTION_IDS } from "@/lib/settings";
import { getActionT } from "@/lib/i18n/server";

const sectionSchema = z.object({
  id: z.enum(HOMEPAGE_SECTION_IDS),
  visible: z.boolean(),
});

export async function getVitrineData() {
  await requirePermission("products:read");
  const [settings, products, collections] = await Promise.all([
    getSettings(),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        isNew: true,
        isFeatured: true,
        isBestseller: true,
        sortOrder: true,
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
      },
      take: 500,
    }),
    prisma.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        products: {
          orderBy: { sortOrder: "asc" },
          select: {
            sortOrder: true,
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
  ]);
  return {
    sections: settings.homepage.sections,
    spotlightProductId: settings.homepage.spotlightProductId,
    products,
    collections,
  };
}

export async function saveVitrineSections(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const actor = await requirePermission("catalog:write");
  const t = await getActionT();
  const parsed = z.array(sectionSchema).max(24).safeParse(input);
  if (!parsed.success) return { ok: false, error: t.reviewFields };
  const seen = new Set<string>();
  const sections = parsed.data.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
  const current = (await getSettings()).homepage;
  await updateSettingsSection("homepage", {
    announcement: current.announcement,
    hero: current.hero,
    featuredCollectionSlug: current.featuredCollectionSlug,
    sections,
    spotlightProductId: current.spotlightProductId,
    showSocialProof: current.showSocialProof,
    socialProofOverride: current.socialProofOverride,
    pillars: current.pillars,
  });
  await recordAudit({
    actorUserId: actor.id,
    action: "VITRINE_SECTIONS_SAVED",
    resource: "Setting",
    resourceId: "homepage",
    metadata: { sections },
  });
  return { ok: true };
}

export async function setSpotlightProduct(
  productId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requirePermission("catalog:write");
  const t = await getActionT();
  if (productId !== null) {
    const parsed = z.string().min(1).max(64).safeParse(productId);
    if (!parsed.success) return { ok: false, error: t.reviewFields };
    const product = await prisma.product.findFirst({
      where: { id: parsed.data, status: "ACTIVE" },
      select: { id: true },
    });
    if (!product) return { ok: false as const, error: t.productUnavailable };
  }
  const current = (await getSettings()).homepage;
  await updateSettingsSection("homepage", {
    announcement: current.announcement,
    hero: current.hero,
    featuredCollectionSlug: current.featuredCollectionSlug,
    sections: current.sections,
    spotlightProductId: productId,
    showSocialProof: current.showSocialProof,
    socialProofOverride: current.socialProofOverride,
    pillars: current.pillars,
  });
  await recordAudit({
    actorUserId: actor.id,
    action: "VITRINE_SPOTLIGHT_SAVED",
    resource: "Setting",
    resourceId: "homepage",
    metadata: { spotlightProductId: productId },
  });
  return { ok: true };
}

export async function moveCollectionProduct(input: {
  collectionId: string;
  productId: string;
  direction: "up" | "down";
}): Promise<{ ok: boolean; error?: string }> {
  const actor = await requirePermission("catalog:write");
  const t = await getActionT();
  const parsed = z
    .object({
      collectionId: z.string().min(1).max(64),
      productId: z.string().min(1).max(64),
      direction: z.enum(["up", "down"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: t.reviewFields };
  try {
    await prisma.$transaction(async (tx) => {
      const links = await tx.collectionProduct.findMany({
        where: { collectionId: parsed.data.collectionId },
        orderBy: [{ sortOrder: "asc" }, { productId: "asc" }],
        select: { productId: true, sortOrder: true },
      });
      const index = links.findIndex((link) => link.productId === parsed.data.productId);
      if (index === -1) throw new Error("NOT_IN_COLLECTION");
      const swapWith = parsed.data.direction === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= links.length) return;
      const current = links[index]!;
      const other = links[swapWith]!;
      // Swap via a temporary out-of-range value to respect the compound key.
      await tx.collectionProduct.update({
        where: {
          collectionId_productId: { collectionId: parsed.data.collectionId, productId: current.productId },
        },
        data: { sortOrder: -1 },
      });
      await tx.collectionProduct.update({
        where: {
          collectionId_productId: { collectionId: parsed.data.collectionId, productId: other.productId },
        },
        data: { sortOrder: current.sortOrder },
      });
      await tx.collectionProduct.update({
        where: {
          collectionId_productId: { collectionId: parsed.data.collectionId, productId: current.productId },
        },
        data: { sortOrder: other.sortOrder },
      });
    });
    await recordAudit({
      actorUserId: actor.id,
      action: "VITRINE_COLLECTION_REORDERED",
      resource: "Collection",
      resourceId: parsed.data.collectionId,
      metadata: { productId: parsed.data.productId, direction: parsed.data.direction },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: t.wentWrong };
  }
}
