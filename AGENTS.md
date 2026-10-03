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

## Database workflow

- Edit `prisma/schema.prisma` → `npm run db:migrate` (generates SQL migration).
- Never edit applied migrations (checksums). New change = new migration.
- `.env` is local-only; `.env.example` documents every variable.
- Seed is idempotent; the demo admin forces a password change on first login.

## Verification pattern

Pure logic gets Vitest tests (`*.test.ts`; `server-only` is stubbed in tests).
For DB-backed flows, add a temporary dev-only route, exercise it over HTTP,
assert results, then **delete the route** (never ship test routes).

## UX bar

Feminine, minimal, editorial, fast on 3G and 360px screens. French copy.
`prefers-reduced-motion` is respected globally. No placeholder buttons — every
control must work or not exist.
