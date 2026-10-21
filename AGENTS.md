# AGENTS.md — Working on Hanadi Store

This file orients AI coding agents. Humans: see `README.md`.

## What this is

Premium fashion/jewelry e-commerce for Algeria. Cash on delivery (COD),
mobile-first trilingual (FR default, EN + AR toggle) storefront + full admin
back office. Real orders, real inventory, real money — treat every change
like it ships to production.

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
npm audit --include=dev --audit-level=high # audit runtime + build/test tooling
```

A change is done only when `typecheck`, `lint`, `test`, the production build,
and the relevant dependency/security checks all pass. For a release candidate,
start with `npm ci --include=dev` so checks use the committed lockfile.

## Layout

- `src/app/(store)/` — public storefront (server components; `"use client"` islands only)
- `src/app/admin/` — back office (`login/`, `first-login/`, `(dashboard)/*`)
- `src/app/api/admin/*` — guarded route handlers (upload, CSV exports, alerts)
- `src/components/` — `ui.tsx` primitives, `storefront/`, `admin/`
- `src/config/brand.ts` — brand values; never hard-code brand identity elsewhere
- `src/lib/` — cross-cutting: `prisma`, `auth/*`, `phone`, `money`, `validation/*`,
  `settings`, `storage`, `notifications`, `meta-capi`, `rate-limit`, `audit`,
  `i18n/` (FR/EN/AR dictionaries, locale cookie, provider, server helpers)
- `src/components/locale-toggle.tsx` — FR/EN/AR switcher (header + admin topbar)
- `src/server/` — domain services (`catalog`, `cart`, `orders`, `coupons`,
  `promotions`, `inventory`, `delivery`, `risk`, `analytics`, `navigation`)
- `src/server/actions/` — server actions only (files with `"use server"` export
  **async functions only** — the build fails otherwise)
- `prisma/` — `schema.prisma`, `prisma.config.ts` (CLI config), versioned SQL `migrations/`, `seed.ts`, factual
  wilaya/commune dataset in `data/`
- `prisma.config.ts` must work with no `.env` file present (that is the CI
  shape: real environment variables only). Guard any `.env` loading with an
  existence check and verify from an env-less directory before pushing.

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
12. **External effects need provider-aware idempotency.** Persist a unique
    `PENDING` delivery record before calling a provider and pass a stable,
    event-derived idempotency key only where that provider supports it. A
    timeout or crash after dispatch is ambiguous: do not blindly retry or mark
    it delivered; surface it for reconciliation. Do not claim exactly-once
    delivery without provider evidence.
13. **Keep dependency security fixes reproducible.** Do not downgrade the
    Next.js toolchain to satisfy an audit blindly. The depth-guarded `braces`
    package is vendored under `vendor/braces` and pinned by the npm override;
    update it only with a reviewed upstream replacement.
14. **No hard-coded user-facing copy outside the dictionaries.** Server
    actions use `getActionT()` (storefront) or `getAdminActionT()` (admin),
    server components use `getDictionary()`, client components use
    `useLocale()` — every FR/EN/AR key lives in all three of
    `src/lib/i18n/fr.ts`, `en.ts`, and `ar.ts` (shape enforced by
    `dictionaries.test.ts`). A success/error string typed directly into an
    action or component is a bug even if it reads correctly in one language.
    Admin and API-route specifics: see "October 2026 audit additions".
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
18. **Cache display data only, never money or stock truth.** Public catalog
    reads (`catalog.ts`, `navigation.ts`) may use `unstable_cache` with the
    shared tags in `src/lib/cache.ts` (300s backstop). Carts, checkout
    pricing, coupons/promotions evaluation, inventory mutations, orders,
    sessions, and per-customer data always read live. Free-text search
    bypasses the cache (unbounded terms would grow cache storage without
    bound). Full-route ISR is incompatible with the cookie locale toggle, so
    do not add `revalidate` expecting edge-cached HTML. Every
    catalog-affecting admin mutation calls `revalidateTag()` next to its
    existing `revalidatePath()`. A stale badge can never oversell or
    misprice because cart/checkout revalidate availability and recompute
    prices server-side.
19. **Production secrets must be distinct and high-entropy.** Production
    validates `AUTH_SECRET`, `ORDER_OUTBOX_SECRET`, and `RETENTION_JOB_SECRET`
    for placeholders, low-diversity/repeating values, minimum length, and
    duplicate values; diagnostics may name a variable but must never print its
    value. Use separate randomly generated values per environment. This check
    is not proof that a secret was generated securely or has not leaked.
20. **Trust only the overwritten client-IP header.** `TRUSTED_CLIENT_IP_HEADER`
    must be a dedicated header stripped from inbound client requests and
    overwritten by the trusted reverse proxy. Never treat `Forwarded` or
    `X-Forwarded-For` chains as trusted identity. Preserve the Edge-safe
    `src/lib/trusted-ip-header.ts` boundary; do not import Node-only modules
    into middleware/shared configuration code.
21. **Enforce MFA from permissions, not role labels alone.** `SUPER_ADMIN` and
    every role with a permission in `MFA_REQUIRED_PERMISSIONS` require verified
    TOTP for the current admin session. Keep the permission list explicit when
    adding sensitive exports, settings, staff-management, or audit surfaces.
    Recovery codes are single-use, stored hashed, and displayed once; never log
    or re-display their values. Preserve password/TOTP re-query behavior and
    validate enrollment, recovery, role changes, and session revocation.
22. **Consent defaults to no analytics.** Pixels and third-party tracking stay
    disabled unless the visitor has granted the applicable consent. Preserve
    reject, revoke/settings, and localized flows; do not initialize analytics
    before consent or infer consent from a page view.
23. **An audit checklist is evidence, not a certification.** Keep
    `docs/AUDIT_RELEASE_GATE.md` tied to the exact release SHA. Unchecked
    project-owner, staging, legal, backup/restore, monitoring, and real-device
    gates remain open; never convert a local build or a green CI run into an
    unsupported production/accessibility/performance claim.

## October 2026 audit additions (verified fixes — preserve these)

- **Idempotency losers never 500.** Concurrent same-key checkouts race on the
  `IdempotencyKey` insert; the loser re-queries on a fresh connection (the
  aborted transaction's connection is poisoned — 25P02), polls for the
  winner's settled result and replays it, else returns `CHECKOUT_IN_PROGRESS`
  (409) for a client retry. Never remove the `P2002` catch in `createOrder`
  without a replacement.
- **Sessions carry identity only.** `getAdminSession`/`getCustomerSession`
  select ids, status, and role — never `passwordHash`/`twoFactorSecret`.
  Password and 2FA actions re-query credentials by id on demand.
- **Notifications are locale-aware (FR/EN).** `templates()` renders from
  `notifyStrings(locale)`; admin status changes pass the admin's locale, the
  order outbox defaults to FR (customer locale is not stored). AR falls back
  to FR until native-speaker templates land.
- **Retention purges CartItem orphans and dead outbox events.** Abandoned-cart
  lines older than the outbox window are batch-deleted; terminal `FAILED`
  outbox events are purged like `COMPLETED` ones. Orders and audit logs are
  never purged.
- **Audit metadata is scrubbed.** `recordAudit` redacts `password*`, `*token*`,
  `*secret*`, `api*key*` keys recursively. Business identifiers (order numbers,
  resource IDs, emails) pass through intentionally.
- **Admin copy resolves through `getAdminActionT()`.** Admin server actions
  and admin API routes pull error copy from the locale cookie via
  `getAdminActionT()` (flat `Dictionary["adminErrors"]`); admin screens use
  `useLocale()`. Do not merge `adminErrors` into `getActionT()` — storefront
  and admin wordings collide on shared keys. Non-AppError branches use
  `t.forbidden`/`t.wentWrong`; `error.userMessage` stays English at the
  developer boundary (CSV export routes are plain downloads and the alerts
  poller only checks `response.ok`, so raw messages never render).
  `/api/internal/*` cron routes stay English by design. Admin rate limits
  surface as 429, never masked as 403.
- **Deliberately untranslated literals.** The honeypot label `"Website"`
  (`ui.tsx`, `aria-hidden`, invisible), the trilingual locale-toggle
  `aria-label` (`"Langue / Language / اللغة"`), and brand proper nouns
  (WhatsApp footer link). Do not "fix" these.
- **Dark-mode hardcode overrides must escape `#` in class references.** In
  `[data-theme="dark"] .text-\[\#9e342e\] { … }` a missing `\#` makes the
  selector invalid (class + unrestricted hash) and browsers and Lightning CSS
  drop the entire rule — three overrides were silently dead that way and it
  caused the three historic CSS build warnings. After editing that block,
  verify `npm run build` prints no CSS warnings and the override colors
  appear in `.next/static/css`.
- **Only above-the-fold images are eager.** The first two product-grid cards,
  collection banner, and sticky-header logo carry `priority`; the root layout
  preconnects to the S3/R2 image origin and middleware appends that origin to
  CSP `connect-src` (Edge-safe helper in `brand.ts`). Everything else stays
  lazy — no below-fold `priority`.
- **Uploads encode lossy WebP q88** (effort 6, ~5–10× smaller than the
  previous lossless pipeline — an intentional replacement, not a regression)
  and pre-check `content-length` before buffering. Keep the 8 MB cap and
  signature validation.
- **Admin login is constant-work and TOTP-aware.** Unknown/disabled accounts
  still run a dummy password verification (no enumeration timing) and TOTP
  failures count toward the five-failure lockout.
- **Search analytics only surface corroborated terms** (count ≥ 2, length
  ≤ 40); retention purges idle search terms. Promotion badges rank percentage
  vs fixed promotions by actual dinar discount, never mixed units.
- **Notification channel toggles filter real dispatch** (all-off is merchant
  intent — audited, not a failure); per-status outbox effects use
  `ORDER_STATUS_UPDATE_<STATUS>` dedupe keys so later transitions are never
  swallowed. Guest checkout strips a taken email from the customer row
  instead of failing the sale (the `P2002` catch stays as the race guard).
  Cancelling an order from admin releases the coupon redemption and usage
  slot; cart coupon preview matches checkout (post-promotion line totals).
- **Hot-path composite indexes ship in a versioned migration and are
  pre-created by `db:deploy`** (Order phone/status/customerId + createdAt,
  Cart status+updatedAt, Notification status+createdAt). Follow the same
  pattern for any new hot-path index.
- **Maintenance detection is a response header, never localized copy.** The
  localized 503 from `maintenanceResponse()` in `src/middleware.ts` carries
  `X-Hanadi-Maintenance: coming-soon`; `scripts/smoke-production-deployment.sh`
  probes that header (legacy `COMING SOON` body text remains only as a
  fallback for older deployments). Localizing the page once silently reddened
  every production smoke run — never reintroduce body-copy matching.
- **Notification configuration may be incomplete only while the public site
  is intentionally closed.** `PUBLIC_SITE_MAINTENANCE=true` may keep admin
  routes available while notification provider settings are still an owner
  gate. Missing providers and a configured `console` placeholder must fail
  sends definitively and must never fall back to console in production. Unknown
  providers remain invalid, and `console` is rejected once maintenance is off;
  configure and verify real providers before disabling maintenance.

## 2026-10-21 full-site audit rules

- **MFA schema rollout is versioned.** The staff MFA/recovery fields are added
  by `prisma/migrations/20261021190000_staff_mfa_recovery/`. Never edit an
  applied migration. Rehearse the change against staging and deploy it through
  `npm run db:deploy` before enabling the matching application version.
- **Dependency CI covers development dependencies.** Run
  `npm audit --include=dev --audit-level=high`; do not replace it with
  `--omit=dev`. Keep CycloneDX SBOM generation, dependency review, CodeQL,
  Gitleaks, and Dependabot workflows enabled. Third-party GitHub Actions use
  immutable full commit SHAs with the release tag in a comment; Dependabot
  updates must preserve that pinning convention. Repository settings (branch
  protection, required checks, secret scanning, and organization Gitleaks
  licensing) still need owner verification.
- **Do not re-expand the vendored `braces` dependency graph.** `vendor/braces`
  contains the required runtime package, not its unused upstream Mocha/Gulp
  development toolchain. If updating it, review the package code and audit the
  complete regenerated lockfile; never use `npm audit fix --force` as a shortcut.
- **Responsive assets and SEO are source changes, not external proof.** Keep
  responsive WebP banner variants, metadata/canonical and sitemap behavior, and
  `noindex` for authenticated account routes. Verify public HTML, image
  delivery, Search Console behavior, and real viewport/device performance
  before claiming deployed SEO or Core Web Vitals outcomes.
- **Retention smoke is fenced by environment.** `npm run smoke:production`
  sends an authorized `POST /api/internal/retention`, so it requires a test-only
  secret and refuses runs unless `CI=true` and the target is HTTP loopback. The
  GitHub CI job binds the standalone app to its disposable PostgreSQL service;
  run the purge only there, never against valuable local, shared staging, or
  production data. Deployment-event smoke has no retention
  secret, accepts only allowlisted Hanadi Vercel hosts, and performs only an
  unauthorized `401` probe. Never create a remote purge workflow that forwards
  a privileged secret to a caller-supplied URL.
- **Production migration ordering is an open provider gate.** The repository
  validates migration structure in CI and documents `npm run db:deploy`, but
  does not enforce that Vercel runs it before production activation. Keep the
  release blocked until the provider owner wires and rehearses that exact step.

## Database workflow

- Edit `prisma/schema.prisma` → `npm run db:migrate` (generates SQL migration).
- Never edit applied migrations (checksums). New change = new migration.
- `.env` is local-only; `.env.example` documents every variable.
- Seed is idempotent; the demo admin forces a password change on first login.
- Do not edit `package-lock.json` manually. If dependencies change, run
  `npm install --package-lock-only`, review the full lockfile diff, then verify
  with `npm ci --include=dev` and `npm audit --include=dev --audit-level=high`.

## Verification pattern

Pure logic gets Vitest tests (`*.test.ts`; `server-only` is stubbed in tests).
For DB-backed flows, add a temporary dev-only route, exercise it over HTTP,
assert results, then **delete the route** (never ship test routes).
For security fixes, add a regression test for the failure mode and run the
complete typecheck, lint, test, production-build, and full dependency-audit
suite. `npm run build` needs a valid public HTTPS `APP_URL`; for local build
verification use a disposable build-only value and never copy that placeholder
into deployment configuration. Do not run authorized retention smoke probes
against a database containing data that must be retained.

## UX bar

Feminine, minimal, editorial, fast on 3G and 360px screens. French by default
with full English and Arabic toggles (see i18n rules below).
`prefers-reduced-motion` is respected globally. No placeholder buttons —
every control must work or not exist.

Minimal direction (October 2026 refresh, do not regress):

- **Buttons are pill-shaped (silver-white system).** The shipped design uses
  `border-radius: 999px` buttons, `0.75rem` fields, `1rem` product cards, and
  flat ink/gold surfaces — the earlier sharp-corner direction is superseded,
  do not "restore" it without an explicit owner decision. Variants: ink
  primary, gold accent, ink-fill outline, border-only ghost. No shine sweeps
  or lift/scale/glow hovers; icon circles and badges stay circular.
- **Header always travels.** Sticky and permanently visible (never hides);
  the brand mark smoothly scales to 82% once scrolled (`scrolled` state,
  transform-only so layout never shifts), disabled under reduced-motion.
  Sticky positioning is load-bearing — keep it.
- **Vertical rhythm lives in `.section-space`** (currently 2.5rem mobile /
  3rem desktop, bottom-weighted via `pt-0` siblings). Tighten/loosen the
  token, never individual sections, unless a seam needs a local override.
- **French by default, English and Arabic on toggle.** Every user-facing string lives in
  `src/lib/i18n/fr.ts` + `en.ts` + `ar.ts` (identical shape, enforced by
  `dictionaries.test.ts` — never add a key to one without the others).
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

For responsive changes, preserve keyboard access, visible focus, and at least
44px touch targets where practical; check narrow widths (including 320px),
390px, 768px, 1024px, and desktop. Run `npm run typecheck`, `npm run lint`,
`npm test`, `npx prettier --check` on changed files, and `npm run build` before
opening or merging a pull request. Do not claim real-device/browser acceptance
without testing those devices and recording the evidence in the release gate.
