import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const { PrismaClient } = require("@prisma/client");
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Set DATABASE_URL (or DIRECT_URL for direct PostgreSQL access) before running online index preparation.",
  );
}

const prisma = new PrismaClient({ datasourceUrl: connectionString });
const indexes = [
  { table: "Address", columns: ["wilayaId"], name: "Address_wilayaId_idx" },
  { table: "Address", columns: ["communeId"], name: "Address_communeId_idx" },
  { table: "CartItem", columns: ["variantId"], name: "CartItem_variantId_idx" },
  {
    table: "CouponCollection",
    columns: ["collectionId"],
    name: "CouponCollection_collectionId_idx",
  },
  { table: "CouponProduct", columns: ["productId"], name: "CouponProduct_productId_idx" },
  { table: "CouponRedemption", columns: ["customerId"], name: "CouponRedemption_customerId_idx" },
  { table: "CouponWilaya", columns: ["wilayaId"], name: "CouponWilaya_wilayaId_idx" },
  { table: "InventoryTransaction", columns: ["userId"], name: "InventoryTransaction_userId_idx" },
  { table: "Order", columns: ["communeId"], name: "Order_communeId_idx" },
  { table: "Order", columns: ["couponId"], name: "Order_couponId_idx" },
  { table: "Order", columns: ["promotionId"], name: "Order_promotionId_idx" },
  {
    table: "OrderStatusHistory",
    columns: ["changedByUserId"],
    name: "OrderStatusHistory_changedByUserId_idx",
  },
  { table: "Promotion", columns: ["collectionId"], name: "Promotion_collectionId_idx" },
  { table: "PromotionProduct", columns: ["productId"], name: "PromotionProduct_productId_idx" },
  { table: "Review", columns: ["customerId"], name: "Review_customerId_idx" },
  { table: "Review", columns: ["orderId"], name: "Review_orderId_idx" },
  { table: "Order", columns: ["phone", "createdAt"], name: "Order_phone_createdAt_idx" },
  { table: "Order", columns: ["status", "createdAt"], name: "Order_status_createdAt_idx" },
  { table: "Order", columns: ["customerId", "createdAt"], name: "Order_customerId_createdAt_idx" },
  { table: "Cart", columns: ["status", "updatedAt"], name: "Cart_status_updatedAt_idx" },
  {
    table: "Notification",
    columns: ["status", "createdAt"],
    name: "Notification_status_createdAt_idx",
  },
];

const normalizeIndexDefinition = (definition) =>
  definition.replaceAll('"', "").replace(/\s+/g, " ").trim().toLowerCase();

async function getIndex(name) {
  const rows = await prisma.$queryRaw`
    SELECT t.relname AS table_name,
           i.indisvalid AS valid,
           i.indisready AS ready,
           pg_get_indexdef(i.indexrelid) AS definition
      FROM pg_class AS idx
      JOIN pg_namespace AS ns ON ns.oid = idx.relnamespace
      JOIN pg_index AS i ON i.indexrelid = idx.oid
      JOIN pg_class AS t ON t.oid = i.indrelid
     WHERE ns.nspname = 'public' AND idx.relname = ${name}
  `;
  return rows[0] ?? null;
}

async function tableAndColumnsExist(table, columns) {
  const rows = await prisma.$queryRaw`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ${table}
    ) AS table_exists,
    (
      SELECT COUNT(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ${table}
         AND column_name = ANY(${columns})
    ) AS columns_found
  `;
  const state = rows[0];
  return {
    tableExists: state.table_exists,
    columnsExist: Number(state.columns_found) === columns.length,
  };
}

async function ensureIndex({ table, columns, name }) {
  const schemaState = await tableAndColumnsExist(table, columns);
  if (!schemaState.tableExists || !schemaState.columnsExist) {
    return "deferred";
  }

  const expectedSuffix = `on public.${table.toLowerCase()} using btree (${columns
    .map((column) => column.toLowerCase())
    .join(", ")})`;
  let existing = await getIndex(name);
  if (existing) {
    const definition = normalizeIndexDefinition(existing.definition);
    if (existing.table_name !== table || !definition.endsWith(expectedSuffix)) {
      throw new Error(
        `Existing index ${name} does not match the expected ${table}(${columns.join(", ")}) index; refusing to alter it.`,
      );
    }
    if (existing.valid && existing.ready) {
      return "existing";
    }

    await prisma.$executeRawUnsafe(`DROP INDEX CONCURRENTLY IF EXISTS public."${name}"`);
  }

  const columnList = columns.map((column) => `"${column}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${name}" ON public."${table}" (${columnList})`,
  );
  existing = await getIndex(name);
  if (!existing || existing.table_name !== table || !existing.valid || !existing.ready) {
    throw new Error(`Concurrent index ${name} was not created in a valid, ready state.`);
  }
  const definition = normalizeIndexDefinition(existing.definition);
  if (!definition.endsWith(expectedSuffix)) {
    throw new Error(`Created index ${name} has an unexpected definition.`);
  }
  return "created";
}

try {
  let created = 0;
  let existing = 0;
  let deferred = 0;
  for (const index of indexes) {
    const result = await ensureIndex(index);
    if (result === "created") created += 1;
    else if (result === "existing") existing += 1;
    else deferred += 1;
  }
  console.log(
    `Online FK indexes: created=${created}, already_valid=${existing}, deferred_until_schema_migration=${deferred}.`,
  );
} finally {
  await prisma.$disconnect();
}
