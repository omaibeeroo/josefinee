import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const migrationsRoot = new URL("../prisma/migrations/", import.meta.url);
const migrationName = /^\d{14}_[a-z0-9]+(?:[_-][a-z0-9]+)*$/;
const destructive =
  /\b(?:DROP\s+(?:TABLE|COLUMN|INDEX)|TRUNCATE(?:\s+TABLE)?|DELETE\s+FROM|ALTER\s+TABLE[^;]*\bALTER\s+COLUMN[^;]*\bTYPE)\b/i;

const entries = (await readdir(migrationsRoot, { withFileTypes: true })).filter((entry) =>
  entry.isDirectory(),
);
if (entries.length === 0) throw new Error("No Prisma migrations were found");

let previous = "";
for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  if (!migrationName.test(entry.name))
    throw new Error(`Invalid migration directory name: ${entry.name}`);
  if (entry.name <= previous)
    throw new Error(`Migration ordering is not deterministic: ${entry.name}`);
  previous = entry.name;
  const migrationPath = join(migrationsRoot.pathname, entry.name, "migration.sql");
  const migrationStat = await stat(migrationPath).catch(() => null);
  if (!migrationStat?.isFile()) throw new Error(`Missing migration.sql in ${entry.name}`);
  const sql = await readFile(migrationPath, "utf8");
  if (destructive.test(sql)) {
    throw new Error(
      `Potentially destructive SQL in ${entry.name}; use an expand/contract migration. Destructive changes require a separate owner-reviewed release procedure and cannot self-approve in SQL comments.`,
    );
  }
}

console.log(
  `Validated ${entries.length} Prisma migration directories; no destructive SQL found.`,
);
