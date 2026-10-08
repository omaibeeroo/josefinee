import { defineConfig } from "prisma/config";

// The Prisma CLI no longer auto-loads .env once a config file exists, so
// load it explicitly (Node built-in — no extra dependency). CI/production
// provide real environment variables, which take precedence over .env.
process.loadEnvFile?.();

// Prisma CLI configuration (replaces the deprecated `prisma` key in
// package.json). The datasource stays defined in prisma/schema.prisma;
// this file only points the CLI at the schema, migrations, and seed command.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
