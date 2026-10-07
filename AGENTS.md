# AGENTS.md — Working on Hanadi Store

This file orients AI coding agents. Humans: see `README.md`.

## What this is

Premium fashion/jewelry e-commerce for Algeria. Cash on delivery (COD),
mobile-first bilingual (FR default, EN toggle) storefront + full admin back
office. Real orders, real inventory, real money — treat every change like it
ships to production.

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
  `settings`, `storage`, `notifications`, `meta-capi`, `rate-limit`, `audit`,
  `i18n/` (FR/EN dictionaries, locale cookie, provider, server helpers)
- `src/components/locale-toggle.tsx` — FR/EN switcher (header + admin topbar)
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
14. **No hard-coded user-facing copy outside the dictionaries.** Server
    actions use `getActionT()`, server components use `getDictionary()`,
    client components use `useLocale()` — every FR/EN key lives in both
    `src/lib/i18n/fr.ts` and `en.ts` (shape enforced by
    `dictionaries.test.ts`). A success/error string typed directly into an
    action or component is a bug even if it reads correctly in one language.
15. **Product images may be absolute or app-relative.** The local storage
    driver returns `/uploads/…` paths; S3/R2 returns absolute URLs.
    `productImageUrl` accepts both (absolute http(s) or a `/`-rooted path —
    never bare filenames, `javascript:`, or `data:`). JSON-LD absolutizes
    relative URLs with `appUrl()` at render time. Never weaken this to accept
    arbitrary schemes.
16. **Entrance animations must degrade to visible.** Any `opacity-0` paired
    with a `motion-safe:` animation must itself be motion-gated
    (`motion-safe:opacity-0`), so `prefers-reduced-motion` users get static
    visible content instead of an invisible page. The same applies to
    `Reveal`-wrapped content: it must be operable and readable without
    intersection/animations firing.
17. **Dropdown nav parents must not duplicate sibling links.** A menu-only
    parent (e.g. CATÉGORIES, whose items are the categories) renders as a
    toggle button (`DesktopDropdown` without `href`), never as a link to a
    URL another top-level item already covers.

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

Feminine, minimal, editorial, fast on 3G and 360px screens. French by default
with a full English toggle (see i18n rules below). `prefers-reduced-motion`
is respected globally. No placeholder buttons — every control must work or
not exist.

Minimal direction (October 2026 refresh, do not regress):

- **Buttons stay flat.** No gradients, shine sweeps, lift/scale/glow hovers,
  or global hover recoloring. Sharp corners (`border-radius: 0`) everywhere,
  including product-detail overrides. Variants: ink primary, gold accent,
  ink-fill outline, border-only ghost.
- **Header always travels.** Sticky and permanently visible (never hides);
  the brand mark smoothly scales to 82% once scrolled (`scrolled` state,
  transform-only so layout never shifts), disabled under reduced-motion.
  Sticky positioning is load-bearing — keep it.
- **Vertical rhythm lives in `.section-space`** (currently 1.5rem mobile /
  1.75rem desktop, bottom-weighted via `pt-0` siblings). Tighten/loosen the
  token, never individual sections, unless a seam needs a local override.
- **French by default, English on toggle.** Every user-facing string lives in
  `src/lib/i18n/fr.ts` + `en.ts` (identical shape, enforced by
  `dictionaries.test.ts` — never add a key to one without the other).
  Server components use `getDictionary()`; client components use
  `useLocale()`; server actions use `getActionT()` (locale cookie
  `hanadi-locale`, `setLocaleAction`, `<html lang>` follows). URL slugs stay
  English-stable — translate names only. Product names/descriptions and other
  DB merchandising content stay French, edited in Admin → Produits.
  Notifications follow the admin's locale (customer locale is not stored).
- **Money/date formatting is hand-rolled** (`formatNumber`, `formatDateFR`,
  `formatDateTimeFR` in `src/lib/money.ts`), never `Intl.*`/`toLocale*` in
  rendered output — ICU differences between server and browser break
  hydration.
- **Dark mode is variable-driven.** All surfaces flow from theme variables;
  `[data-theme="dark"]` in `globals.css` only remaps them (plus a few named
  hardcode overrides). Never add per-component dark classes; never use
  `text-white` (use `text-[#fff]` for text that must stay white on colored
  badges). Theme cookie `hanadi-theme`, `setThemeAction`, `<html data-theme>`
  from the root layout. Light is the default; admin brand colors apply in
  light mode only.
- **Announcement bar is settings-driven** (`homepage.announcement.isActive`).
  Never hard-remove it from `SiteChrome`; toggle it in Admin → Réglages.
- **Homepage order is admin data, not code.** Blocks render from
  `settings.homepage.sections` (ordered, visible-filtered) and the spotlight
  from `spotlightProductId` (null = first featured). Never hard-code block
  order in `(store)/page.tsx`. Manual collections order by
  `CollectionProduct.sortOrder`; global carousels by `isFeatured` then product
  `sortOrder`. Vitrine actions live in `src/server/actions/vitrine.ts`
  (`catalog:write`, audited).


## Mobile and browser compatibility rules

14. **Mobile is a first-class target.** Preserve the 360px–desktop responsive layout and test changes at 360px, 390px, 768px, 1024px, and desktop widths. Do not introduce horizontal overflow, fixed elements hidden behind iOS safe areas, or controls that require hover.
15. **Support touch and keyboard.** Use `touch-action: manipulation` where appropriate, keep visible `:focus-visible` states, use real buttons/links, and ensure dialogs/drawers trap focus and allow Escape/backdrop close. Never rely solely on hover for a feature.
16. **Respect mobile viewport behavior.** Use safe-area insets and dynamic/small viewport units for full-screen UI. Keep form controls at least 16px on small screens to prevent iOS Safari auto-zoom. Preserve `prefers-reduced-motion` behavior.
17. **Keep browser fallbacks.** When using newer CSS such as `:has()`, `backdrop-filter`, or hover-only effects, provide a graceful fallback or explicit state class. Do not assume Chromium-only APIs.
18. **PWA metadata is part of the shell.** Keep `src/app/manifest.ts`, root `viewport` metadata, iOS web-app metadata, and `/icon.svg` consistent when changing branding or install behavior.

## GitHub/Vercel deployment rules

19. **Repository visibility is deployment-critical.** `omaibeeroo/josefinee` is public because the linked Vercel team is on Hobby; Vercel Hobby blocks Git deployments from private GitHub organization repositories. Do not change visibility without explicitly coordinating the Vercel plan and deployment strategy.
20. **Verify Vercel after merges.** `main` is the production branch and other branches receive Preview deployments. A blocked deployment caused by repository/account configuration cannot be redeployed directly; after correcting configuration, push a fresh commit to create a new deployment. Confirm the new deployment reaches `READY` before calling it live.
21. **Public-repository hygiene is mandatory.** Never commit secrets, `.env`, customer data, database dumps, private URLs, or credentials. Treat all Git history as public. Rotate any credential that appears in a commit, even if the file is later deleted.

For responsive changes, run `npm run typecheck`, `npm run lint`, `npm test`, `npx prettier --check` on changed files, and `npm run build` before opening or merging a pull request.
