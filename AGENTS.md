# AGENTS.md — Working on Josefinee

This file orients AI coding agents. Humans: see `README.md`.

## What this is

Premium fashion/jewelry e-commerce for Algeria. Cash on delivery (COD),
mobile-first French-locale storefront + full admin back office. Real orders,
real inventory, real money — treat every change like it ships to production.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 ·
Prisma 6 · PostgreSQL · Argon2id · S3-compatible storage. No microservices.

## Commands

```bash
npm run dev          # develop (needs DATABASE_URL)
npm run build        # production build (Next.js type/lint checks run during build)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest run
npm run db:migrate   # prisma migrate dev (local)
npm run db:deploy    # prisma migrate deploy (staging/prod)
npm run db:seed      # idempotent seed (safe to re-run)
npm run db:studio    # inspect data
```

A change is done only when `typecheck`, `lint`, `test` and `build` all pass.

## Layout

- `src/app/(store)/` — public storefront (server components; `"use client"` islands only)
- `src/app/admin/` — back office (`login/`, `first-login/`, `(dashboard)/*`)
- `src/app/api/admin/*` — guarded route handlers (upload, CSV exports, alerts)
- `src/components/` — `ui.tsx` primitives, `storefront/`, `admin/`
- `src/config/brand.ts` — brand values; never hard-code brand identity elsewhere
- `src/lib/` — cross-cutting: `prisma`, `auth/*`, `phone`, `money`, `validation/*`,
  `settings`, `storage`, `notifications`, `meta-capi`, `rate-limit`, `audit`
- `src/server/` — domain services (`catalog`, `cart`, `orders`, `coupons`,
  `promotions`, `inventory`, `delivery`, `risk`, `analytics`, `navigation`)
- `src/server/actions/` — server actions only (files with `"use server"` export
  **async functions only** — the build fails otherwise)
- `prisma/` — `schema.prisma`, versioned SQL `migrations/`, `seed.ts`, factual
  wilaya/commune dataset in `data/`

## Non-negotiable invariants

1. **Money is integer dinars.** Never floats. Format with `formatDA()`.
2. **The client never sets prices.** Checkout reloads every variant, recomputes
   subtotal → promotion → coupon → delivery → total server-side, inside one
   Prisma transaction (`src/server/orders.ts`). Never trust client math.
3. **Inventory is decremented atomically** (`updateMany` with `stock >= qty`).
   Negative stock is a bug, full stop.
4. **No fabricated data.** Stats, reviews, sold counts come from the DB or stay
   hidden. Never invent brand assets, credentials, or API keys.
5. **Every admin action requires a permission** (`requirePermission`) and writes
   an audit log. Every public mutation is Zod-validated + rate-limited.
6. **HTML is sanitized** (`cleanRichText`) before storage/render. React escapes
   everything else — never add `dangerouslySetInnerHTML` for user content.
7. **Secrets stay in env.** Never commit `.env`. Never log passwords/tokens.
8. **Order of discount application:** automatic promotion first, coupon on the
   remainder, then delivery (free-shipping threshold applies post-promotion).
9. **Runtime validation is mandatory.** Server actions and route handlers are
   remote boundaries; TypeScript types are not validation. Use the shared Zod
   schemas in `src/lib/validation/common.ts` and `src/lib/validation/admin.ts`
   for IDs, enums, pagination, dates, searches, and all untrusted inputs.
   The admin module includes `adminId`, `adminPage`, `adminSearch`, status
   enums, `productListParams`, `inventoryListParams`, `auditListParams`,
   `orderFilters`, `deliveryCsv`, `customerNotes`, `settingsKey`, and
   `settingsValue`. Reuse these before Prisma work; add a local schema for
   domain-specific form payloads.
10. **Validate after authorization, before data access.** Admin actions must
   call `requirePermission()` first, then `safeParse()` all arguments, and only
   then execute a Prisma query or mutation. Invalid list/filter input returns a
   bounded empty result; invalid mutations return a controlled error object or
   `AppError`, never an unhandled Zod/Prisma exception.
11. **Concurrent writes must be serialized or conditional.** Absolute
    inventory edits use a PostgreSQL transaction advisory lock per variant;
    preserve that invariant for any new stock or reservation operation.
12. **External effects must be retry-safe.** Outbox effects are at-least-once.
    Pass a stable event-derived idempotency key to every provider and persist
    provider delivery records; never assume a process crash means the provider
    did not accept a request.
13. **Keep dependency security fixes reproducible.** Do not downgrade the
    Next.js toolchain to satisfy an audit blindly. The depth-guarded `braces`
    package is vendored under `vendor/braces` and pinned by the npm override;
    update it only with a reviewed upstream replacement.

## Database workflow

- Edit `prisma/schema.prisma` → `npm run db:migrate` (generates SQL migration).
- Never edit applied migrations (checksums). New change = new migration.
- `.env` is local-only; `.env.example` documents every variable.
- Seed is idempotent; the demo admin forces a password change on first login.
- Do not edit `package-lock.json` manually. If dependencies change, run
  `npm install --package-lock-only` and review both the lockfile and
  `npm audit --omit=dev` output.

## Verification pattern

Pure logic gets Vitest tests (`*.test.ts`; `server-only` is stubbed in tests).
For DB-backed flows, add a temporary dev-only route, exercise it over HTTP,
assert results, then **delete the route** (never ship test routes).
For security fixes, add a regression test for the failure mode and run the
complete typecheck, lint, test, production-build, and dependency-audit suite.

## UX bar

Feminine, minimal, editorial, fast on 3G and 360px screens. French copy.
`prefers-reduced-motion` is respected globally. No placeholder buttons — every
control must work or not exist.
