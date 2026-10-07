/**
 * Development/database seed.
 *
 * Idempotent: safe to run multiple times. Uses only generic, fictional
 * products — never real brand assets. Replace everything in `prisma/seed.ts`
 * and this file with your own catalog when you go live.
 *
 *   1. Roles + permissions (RBAC)
 *   2. Demo admin account (from env; forced password change)
 *   3. All 58 wilayas + communes (public factual dataset)
 *   4. Default delivery rates per wilaya (EDIT BEFORE GOING LIVE)
 *   5. Categories, collections, fictional products
 *   6. CMS pages, FAQs, announcement
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { ROLE_PERMISSIONS, ROLES } from "../src/lib/auth/permissions";
import { slugify } from "../src/lib/slug";

// Local copy of the Argon2id parameters (src/lib/auth/password cannot be
// imported here — it pulls in the `server-only` guard, which throws under
// plain Node). Parameters must match password.ts.
async function hashPassword(password: string): Promise<string> {
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

const prisma = new PrismaClient();

type RawCity = {
  wilaya_code: string;
  wilaya_name_ascii: string;
  wilaya_name: string;
  commune_name_ascii: string;
  commune_name: string;
};

// --- Delivery defaults (PLACEHOLDERS — verify with your carrier) ------------
const CENTRAL = new Set([9, 16, 31, 35, 42]); // Alger, Oran, Blida, Boumerdès, Tipaza
const SOUTH = new Set([1, 3, 8, 11, 12, 17, 30, 32, 33, 37, 39, 40, 41, 45, 47, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58]);

function defaultRates(code: number) {
  if (CENTRAL.has(code)) {
    return [
      { method: "HOME", price: 600, etaMin: 1, etaMax: 2 },
      { method: "STOPDESK", price: 350, etaMin: 1, etaMax: 2 },
      { method: "EXPRESS", price: 950, etaMin: 1, etaMax: 1 },
      { method: "STANDARD", price: 450, etaMin: 2, etaMax: 3 },
    ];
  }
  if (SOUTH.has(code)) {
    return [
      { method: "HOME", price: 1300, etaMin: 3, etaMax: 7 },
      { method: "STOPDESK", price: 800, etaMin: 3, etaMax: 6 },
      { method: "EXPRESS", price: 1800, etaMin: 2, etaMax: 4 },
      { method: "STANDARD", price: 1100, etaMin: 4, etaMax: 8 },
    ];
  }
  return [
    { method: "HOME", price: 800, etaMin: 2, etaMax: 3 },
    { method: "STOPDESK", price: 450, etaMin: 2, etaMax: 3 },
    { method: "EXPRESS", price: 1150, etaMin: 1, etaMax: 2 },
    { method: "STANDARD", price: 650, etaMin: 2, etaMax: 4 },
  ];
}

// --- Fictional catalog --------------------------------------------------------
type SeedVariant = { label: string; sku: string; price?: number; stock: number; color?: string };

type SeedProduct = {
  name: string;
  slug: string;
  sku: string;
  price: number;
  compareAt?: number;
  short: string;
  description: string;
  category: string;
  collections: string[];
  tags: string[];
  material: string;
  color?: string;
  isNew?: boolean;
  isBestseller?: boolean;
  isFeatured?: boolean;
  variants: SeedVariant[];
};

const PRODUCTS: SeedProduct[] = [
  {
    name: "Luna Pearl Necklace",
    slug: "luna-pearl-necklace",
    sku: "HAN-001",
    price: 2900,
    compareAt: 3600,
    short: "A freshwater pearl pendant on a fine gold-tone chain.",
    description:
      "<p>The Luna necklace pairs a lustrous freshwater pearl with a delicate fine-link chain. Lightweight, timeless, and made to be worn every day.</p><ul><li>Freshwater pearl, gold-tone stainless steel</li><li>Chain length 40 cm + 5 cm extender</li><li>Tarnish-resistant, nickel-free</li></ul>",
    category: "necklaces",
    collections: ["jewelry", "new-in"],
    tags: ["necklace", "pearl", "gold", "jewelry"],
    material: "Freshwater pearl, stainless steel",
    isNew: true,
    isBestseller: true,
    isFeatured: true,
    variants: [
      { label: "Gold", sku: "HAN-001-G", stock: 14 },
      { label: "Silver", sku: "HAN-001-S", stock: 10 },
    ],
  },
  {
    name: "Nova Orb Bracelet",
    slug: "nova-orb-bracelet",
    sku: "HAN-002",
    price: 1900,
    short: "A polished orb charm bracelet with adjustable chain.",
    description:
      "<p>Nova is the everyday bracelet: a single polished orb on an adjustable chain that sits perfectly alone or stacked.</p>",
    category: "bracelets",
    collections: ["jewelry", "best-sellers"],
    tags: ["bracelet", "gold", "jewelry"],
    material: "Stainless steel, 18k gold finish",
    isBestseller: true,
    isFeatured: true,
    variants: [
      { label: "Gold", sku: "HAN-002-G", stock: 18 },
      { label: "Silver", sku: "HAN-002-S", stock: 12 },
    ],
  },
  {
    name: "Aurelia Ring",
    slug: "aurelia-ring",
    sku: "HAN-003",
    price: 1600,
    short: "A sculptural dome ring with a mirror finish.",
    description:
      "<p>Aurelia's smooth dome catches the light from every angle. Comfortable for daily wear with a polished, tarnish-resistant finish.</p>",
    category: "rings",
    collections: ["jewelry", "new-in"],
    tags: ["ring", "gold", "jewelry"],
    material: "Stainless steel, 18k gold finish",
    isNew: true,
    isFeatured: true,
    variants: [
      { label: "Size 16", sku: "HAN-003-16", stock: 8 },
      { label: "Size 17", sku: "HAN-003-17", stock: 9 },
      { label: "Size 18", sku: "HAN-003-18", stock: 7 },
    ],
  },
  {
    name: "Celeste Stud Earrings",
    slug: "celeste-stud-earrings",
    sku: "HAN-004",
    price: 1400,
    short: "Star-set crystal studs for everyday shine.",
    description:
      "<p>Small, brilliant, and endlessly wearable. Celeste studs add a quiet sparkle to any look.</p>",
    category: "earrings",
    collections: ["jewelry", "best-sellers"],
    tags: ["earrings", "crystal", "jewelry"],
    material: "Cubic zirconia, gold-tone steel",
    isFeatured: true,
    variants: [{ label: "Gold", sku: "HAN-004-G", stock: 20 }],
  },
  {
    name: "Dounia Gold Hoops",
    slug: "dounia-gold-hoops",
    sku: "HAN-005",
    price: 1700,
    short: "Medium everyday hoops with a soft shine.",
    description:
      "<p>The hoops you will reach for daily — featherlight, secure-click, and finished to resist tarnish.</p>",
    category: "earrings",
    collections: ["jewelry", "new-in"],
    tags: ["earrings", "hoops", "gold", "jewelry"],
    material: "Stainless steel, 18k gold finish",
    isNew: true,
    variants: [{ label: "Gold", sku: "HAN-005-G", stock: 16 }],
  },
  {
    name: "Mira Mini Bag",
    slug: "mira-mini-bag",
    sku: "HAN-006",
    price: 4500,
    compareAt: 5200,
    short: "A structured mini bag with gold-tone hardware.",
    description:
      "<p>Mira carries the essentials — phone, cardholder, lipstick — in a structured silhouette with a detachable chain strap. Wear it crossbody or as a clutch.</p>",
    category: "bags",
    collections: ["bags", "best-sellers"],
    tags: ["bag", "mini", "leather"],
    material: "Vegan leather, metal hardware",
    color: "Noir",
    isBestseller: true,
    isFeatured: true,
    variants: [
      { label: "Noir", sku: "HAN-006-BLK", stock: 9 },
      { label: "Camel", sku: "HAN-006-CML", stock: 7 },
    ],
  },
  {
    name: "Yasmin Quilted Tote",
    slug: "yasmin-quilted-tote",
    sku: "HAN-007",
    price: 5800,
    short: "A soft quilted tote that fits your whole day.",
    description:
      "<p>Yasmin is the carry-everything tote: padded quilting, magnetic closure, and an interior pocket for your essentials.</p>",
    category: "bags",
    collections: ["bags", "new-in"],
    tags: ["bag", "tote"],
    material: "Quilted vegan leather",
    color: "Crème",
    isNew: true,
    variants: [{ label: "Crème", sku: "HAN-007-CRM", stock: 6 }],
  },
  {
    name: "Selma Silk-Touch Scarf",
    slug: "selma-silk-touch-scarf",
    sku: "HAN-008",
    price: 1200,
    short: "A soft printed scarf in a timeless motif.",
    description:
      "<p>Selma drapes beautifully as a headscarf, neck scarf, or bag accessory. Soft-touch fabric with hand-rolled edges.</p>",
    category: "scarves",
    collections: ["accessories"],
    tags: ["scarf", "accessories"],
    material: "Silk-touch polyester",
    variants: [{ label: "Motif Ivoire", sku: "HAN-008-IVR", stock: 22 }],
  },
];

const CATEGORIES: Array<{ slug: string; name: string; parent?: string }> = [
  { slug: "jewelry", name: "Bijoux" },
  { slug: "necklaces", name: "Colliers", parent: "jewelry" },
  { slug: "bracelets", name: "Bracelets", parent: "jewelry" },
  { slug: "earrings", name: "Boucles d’oreilles", parent: "jewelry" },
  { slug: "rings", name: "Bagues", parent: "jewelry" },
  { slug: "sets", name: "Ensembles", parent: "jewelry" },
  { slug: "bags-wallets", name: "Sacs & Portefeuilles" },
  { slug: "bags", name: "Sacs", parent: "bags-wallets" },
  { slug: "wallets", name: "Portefeuilles", parent: "bags-wallets" },
  { slug: "accessories", name: "Accessoires" },
  { slug: "watches", name: "Montres", parent: "accessories" },
  { slug: "belts", name: "Ceintures", parent: "accessories" },
  { slug: "scarves", name: "Foulards", parent: "accessories" },
  { slug: "clothes", name: "Vêtements" },
];

const COLLECTIONS: Array<{ slug: string; name: string; type: "MANUAL" | "NEW_IN" | "BEST_SELLERS" | "SALE"; description: string }> = [
  { slug: "jewelry", name: "Bijoux", type: "MANUAL", description: "Colliers, bracelets, boucles d’oreilles et bagues." },
  { slug: "bags", name: "Sacs", type: "MANUAL", description: "Mini sacs, cabas et compagnons du quotidien." },
  { slug: "accessories", name: "Accessoires", type: "MANUAL", description: "Foulards et touches finales." },
  { slug: "new-in", name: "Nouveautés", type: "NEW_IN", description: "Les dernières arrivées." },
  { slug: "best-sellers", name: "Meilleures ventes", type: "BEST_SELLERS", description: "Les plus aimées, les plus recommandées." },
  { slug: "sale", name: "Promotions", type: "SALE", description: "Offres à durée limitée." },
  { slug: "shop-all", name: "Toute la boutique", type: "MANUAL", description: "Tout, au même endroit." },
];

const PAGES: Array<{ slug: string; title: string; content: string }> = [
  {
    slug: "privacy-policy",
    title: "Politique de confidentialité",
    content:
      "<p>Nous collectons uniquement les informations nécessaires pour traiter et livrer votre commande : vos nom, numéro de téléphone, adresse de livraison et détails de commande.</p><h3>Utilisation de vos données</h3><ul><li>Préparer, livrer et confirmer vos commandes</li><li>Vous contacter au sujet de vos commandes</li><li>Améliorer notre boutique (statistiques anonymes)</li></ul><p>Nous ne vendons jamais vos données personnelles. Vous pouvez demander l’accès ou la suppression de vos données à tout moment via le service client.</p>",
  },
  {
    slug: "terms",
    title: "Conditions générales",
    content:
      "<p>En passant commande, vous acceptez de fournir des coordonnées et une adresse de livraison exactes. Les commandes se paient en espèces à la livraison. Nous nous réservons le droit d’annuler les commandes aux coordonnées invalides ou suspectes, et de confirmer chaque commande par téléphone avant expédition.</p>",
  },
  {
    slug: "shipping",
    title: "Informations de livraison",
    content:
      "<p>Nous livrons dans les 58 wilayas d’Algérie, à domicile ou en point de retrait. Frais et délais estimés affichés avant confirmation — le prix affiché est celui payé en espèces à la réception.</p>",
  },
  {
    slug: "returns",
    title: "Retours & échanges",
    content:
      "<p>Changement d’avis ? Contactez-nous sous 7 jours après livraison. Les articles doivent être non portés, non lavés, dans leur emballage d’origine. Les bijoux ne peuvent être retournés que s’ils sont défectueux, pour des raisons d’hygiène. Les frais de livraison ne sont pas remboursables.</p>",
  },
  {
    slug: "cookies",
    title: "Politique cookies",
    content:
      "<p>Nous utilisons des cookies strictement nécessaires (panier, sécurité) et, avec votre consentement, des cookies d’analyse pour comprendre les visites. Vous pouvez accepter ou refuser les cookies non essentiels à tout moment.</p>",
  },
];

const FAQS: Array<{ category: string; question: string; answer: string }> = [
  { category: "Commande", question: "Comment passer commande ?", answer: "Ajoutez vos articles au panier, finalisez la commande avec vos nom, téléphone, wilaya, commune et adresse, puis confirmez. Nous vous appellerons pour confirmer avant l’expédition." },
  { category: "Commande", question: "Faut-il un compte pour commander ?", answer: "Non. Vous pouvez commander sans compte. Un compte garde simplement votre historique et vos favoris." },
  { category: "Livraison", question: "Combien coûte la livraison ?", answer: "Les frais dépendent de votre wilaya et du mode de livraison, et s’affichent avant confirmation. Aucun frais caché." },
  { category: "Livraison", question: "Quels sont les délais de livraison ?", answer: "Généralement 24 à 72 heures pour le centre et le nord, et 3 à 7 jours pour le sud. L’estimation pour votre wilaya s’affiche à la commande." },
  { category: "Paiement", question: "Comment payer ?", answer: "Paiement à la livraison. Vous payez en dinars algériens à la réception de votre commande." },
  { category: "Retours", question: "Puis-je retourner ou échanger un article ?", answer: "Oui, sous 7 jours après livraison pour les articles non portés dans leur emballage d’origine. Contactez le service client pour organiser cela." },
  { category: "Produits", question: "Les bijoux ternissent-ils ?", answer: "Nos pièces résistent au ternissement, mais comme tous les bijoux fantaisie, elles durent plus longtemps gardées au sec et rangées dans leur pochette." },
];

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (
    !adminPassword ||
    adminPassword.length < 10 ||
    !/[a-z]/.test(adminPassword) ||
    !/[A-Z]/.test(adminPassword) ||
    !/[0-9]/.test(adminPassword)
  ) {
    throw new Error("SEED_ADMIN_PASSWORD must be explicitly set to a strong password before seeding.");
  }

  console.log("Seeding roles & permissions...");
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      create: { name: role.name, label: role.label, description: role.description },
      update: { label: role.label, description: role.description },
    });
  }
  const permissionCodes = Array.from(
    new Set(Object.values(ROLE_PERMISSIONS).flat()),
  );
  for (const code of permissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      create: { code, description: code },
      update: {},
    });
  }
  const permissionByCode = new Map(
    (await prisma.permission.findMany()).map((p) => [p.code, p.id]),
  );
  for (const role of ROLES) {
    const dbRole = await prisma.role.findUniqueOrThrow({ where: { name: role.name } });
    await prisma.rolePermission.deleteMany({ where: { roleId: dbRole.id } });
    await prisma.rolePermission.createMany({
      data: (ROLE_PERMISSIONS[role.name] ?? []).flatMap((code) => {
        const permissionId = permissionByCode.get(code);
        return permissionId ? [{ roleId: dbRole.id, permissionId }] : [];
      }),
    });
  }

  console.log("Seeding demo admin...");
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: "SUPER_ADMIN" } });
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: process.env.SEED_ADMIN_NAME ?? "Store Admin",
      passwordHash: await hashPassword(adminPassword),
      roleId: superAdmin.id,
      mustChangePassword: true,
    },
    update: {},
  });
  console.log(`  admin: ${adminEmail} (password change required on first login)`);

  console.log("Seeding wilayas & communes...");
  const raw = JSON.parse(
    readFileSync(join(__dirname, "data", "algeria_cities.json"), "utf8"),
  ) as RawCity[];

  const wilayaGroups = new Map<
    string,
    { code: number; name: string; nameAr: string; communes: Map<string, string> }
  >();

  for (const entry of raw) {
    const code = Number.parseInt(entry.wilaya_code, 10);
    if (!Number.isFinite(code)) continue;
    const key = String(code);
    let group = wilayaGroups.get(key);
    if (!group) {
      group = {
        code,
        name: titleCase(entry.wilaya_name_ascii),
        nameAr: entry.wilaya_name,
        communes: new Map(),
      };
      wilayaGroups.set(key, group);
    }
    const communeName = titleCase(entry.commune_name_ascii);
    if (communeName && !group.communes.has(communeName)) {
      group.communes.set(communeName, entry.commune_name);
    }
  }

  console.log(`  ${wilayaGroups.size} wilayas found`);
  for (const group of wilayaGroups.values()) {
    const wilaya = await prisma.wilaya.upsert({
      where: { code: group.code },
      create: {
        code: group.code,
        name: group.name,
        nameAr: group.nameAr,
        stopdeskAvailable: !SOUTH.has(group.code),
      },
      update: { name: group.name, nameAr: group.nameAr },
    });

    const existing = await prisma.commune.findMany({
      where: { wilayaId: wilaya.id },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((c) => c.name));
    const missing = [...group.communes.entries()].filter(([name]) => !existingNames.has(name));
    if (missing.length > 0) {
      await prisma.commune.createMany({
        data: missing.map(([name, nameAr]) => ({
          wilayaId: wilaya.id,
          name,
          nameAr,
        })),
        skipDuplicates: true,
      });
    }

    for (const rate of defaultRates(group.code)) {
      await prisma.deliveryRate.upsert({
        where: { wilayaId_method: { wilayaId: wilaya.id, method: rate.method as never } },
        create: {
          wilayaId: wilaya.id,
          method: rate.method as never,
          price: rate.price,
          etaMinDays: rate.etaMin,
          etaMaxDays: rate.etaMax,
          isActive: rate.method !== "STOPDESK" || !SOUTH.has(group.code),
        },
        update: {},
      });
    }
  }

  console.log("Seeding categories & collections...");
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { slug: category.slug, name: category.name, isActive: true, sortOrder: 0 },
      update: { name: category.name },
    });
  }
  for (const category of CATEGORIES) {
    if (!category.parent) continue;
    const parent = await prisma.category.findUnique({ where: { slug: category.parent } });
    if (parent) {
      await prisma.category.update({
        where: { slug: category.slug },
        data: { parentId: parent.id },
      });
    }
  }
  for (const collection of COLLECTIONS) {
    await prisma.collection.upsert({
      where: { slug: collection.slug },
      create: {
        slug: collection.slug,
        name: collection.name,
        type: collection.type as never,
        description: collection.description,
        isActive: true,
        isFeatured: collection.slug === "jewelry",
      },
      update: { name: collection.name },
    });
  }

  console.log("Seeding products...");
  const categoryBySlug = new Map(
    (await prisma.category.findMany()).map((c) => [c.slug, c.id]),
  );
  const collectionBySlug = new Map(
    (await prisma.collection.findMany()).map((c) => [c.slug, c.id]),
  );

  for (const seed of PRODUCTS) {
    const categoryId = categoryBySlug.get(seed.category);
    if (!categoryId) continue;

    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        shortDescription: seed.short,
        price: seed.price,
        compareAtPrice: seed.compareAt ?? null,
        sku: seed.sku,
        status: "ACTIVE",
        publishedAt: new Date(),
        categoryId,
        tags: seed.tags.map((tag) => tag.toLowerCase()),
        material: seed.material,
        color: seed.color ?? null,
        isNew: seed.isNew ?? false,
        isBestseller: seed.isBestseller ?? false,
        isFeatured: seed.isFeatured ?? false,
        seoTitle: seed.name,
        seoDescription: seed.short,
      },
      update: {
        name: seed.name,
        price: seed.price,
        compareAtPrice: seed.compareAt ?? null,
        status: "ACTIVE",
      },
    });

    // One option group when variants carry labels.
    let optionValueIds: string[] = [];
    if (seed.variants.length > 1) {
      const option = await prisma.productOption.upsert({
        where: { productId_name: { productId: product.id, name: "Finish" } },
        create: { productId: product.id, name: "Finition", position: 0 },
        update: {},
      });
      optionValueIds = [];
      for (const [index, variant] of seed.variants.entries()) {
        const value = await prisma.productOptionValue.upsert({
          where: { optionId_value: { optionId: option.id, value: variant.label } },
          create: { optionId: option.id, value: variant.label, position: index },
          update: {},
        });
        optionValueIds.push(value.id);
      }
    }

    const existingVariants = await prisma.productVariant.findMany({
      where: { productId: product.id },
      select: { id: true, sku: true },
    });
    const existingInventory = new Map(
      (await prisma.inventory.findMany({
        where: { variantId: { in: existingVariants.map((v) => v.id) } },
      })).map((inv) => [inv.variantId, inv.stock]),
    );

    for (const [index, seedVariant] of seed.variants.entries()) {
      let record = existingVariants.find((v) => v.sku === seedVariant.sku);
      if (!record) {
        record = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: seedVariant.sku,
            price: seedVariant.price ?? null,
            optionLabel: seedVariant.label,
            position: index,
            isActive: true,
          },
        });
      }
      const stock = existingInventory.get(record.id) ?? seedVariant.stock;
      await prisma.inventory.upsert({
        where: { variantId: record.id },
        create: { variantId: record.id, stock, lowStockThreshold: 3 },
        update: {},
      });
      if (optionValueIds[index]) {
        await prisma.variantOptionValue.upsert({
          where: { variantId_optionValueId: { variantId: record.id, optionValueId: optionValueIds[index]! } },
          create: { variantId: record.id, optionValueId: optionValueIds[index]! },
          update: {},
        });
      }
    }

    const allCollections = [...new Set([...seed.collections, "shop-all"])];
    for (const slug of allCollections) {
      const collectionId = collectionBySlug.get(slug);
      if (!collectionId) continue;
      await prisma.collectionProduct.upsert({
        where: { collectionId_productId: { collectionId, productId: product.id } },
        create: { collectionId, productId: product.id },
        update: {},
      });
    }
  }

  console.log("Seeding CMS content...");
  for (const page of PAGES) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      create: { slug: page.slug, title: page.title, content: page.content, isPublished: true },
      update: {},
    });
  }
  for (const [index, faq] of FAQS.entries()) {
    const slug = slugify(faq.question).slice(0, 60);
    const exists = await prisma.faqItem.findFirst({
      where: { category: faq.category, question: faq.question },
    });
    if (!exists) {
      await prisma.faqItem.create({
        data: { category: faq.category, question: faq.question, answer: faq.answer, sortOrder: index },
      });
    }
    void slug;
  }
  await prisma.announcement.upsert({
    where: { id: "seed_default_announcement" },
    create: {
      id: "seed_default_announcement",
      text: "Livraison express partout en Algérie — Paiement à la livraison",
      href: "/collections/new-in",
      isActive: true,
      sortOrder: 0,
    },
    update: {},
  });

  console.log("Seed complete.");
}

function titleCase(input: string): string {
  return input
    .split(/[\s-]+/)
    .map((part) =>
      part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join(" ");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
