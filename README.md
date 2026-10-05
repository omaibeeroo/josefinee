# Josefinee — Premium COD E-Commerce for Algeria

A complete, production-ready e-commerce application for a fashion/jewelry brand
selling in **Algeria** with **Cash on Delivery (COD)**. Mobile-first, French-locale
storefront plus a full admin back office.

> **Brand:** every brand value (name, logo, colors, copy, social links) lives in
> `src/config/brand.ts` and the database `Setting` table. The storefront brand is
> Josefinee; update these sources when changing it again. Nothing is hard-coded
> into the UI.

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Frontend   | Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS 4 |
| Backend    | Next.js Server Actions + Route Handlers (modular monolith)    |
| Database   | PostgreSQL 16+ with Prisma ORM 6                              |
| Auth       | Argon2id passwords, opaque sessions (HTTP-only cookies), TOTP 2FA for staff |
| Storage    | S3-compatible object storage (R2/S3/MinIO) · local disk in dev |
| Deploy     | `output: "standalone"` — Vercel, VPS, or any Node host        |

Money is stored as **integer dinars** (no floats). Prices, delivery fees and
discounts are **always recomputed server-side** — the client can never submit a price.

## Quick start (local)

Requirements: Node.js 20+, a PostgreSQL database.

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# edit DATABASE_URL, AUTH_SECRET (openssl rand -base64 48), and set a unique
# SEED_ADMIN_PASSWORD before running the seed

# 3. Database (option A — local Postgres via Docker)
docker compose up -d postgres

# 3. Database (option B — managed Postgres)
#    paste its connection string into DATABASE_URL

# 4. Migrate + seed (58 wilayas, 1541 communes, RBAC, demo admin, catalog, CMS)
npm run db:deploy
npx prisma db seed

# 5. Run
npm run dev
```

Open http://localhost:3000. Admin: http://localhost:3000/admin

### Demo admin (development only)

Configured through env, never hard-coded. Set a unique strong password before
seeding; the seed fails closed if it is absent. Do not use a repository-published
demo password:

```bash
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<set-a-unique-strong-password>
```

The seeded admin **must change its password on first login**. Create real staff
accounts under **Admin → Staff** afterwards and disable the demo account.

## Environment variables

See `.env.example` for the full list. Highlights:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Optional direct PostgreSQL connection for online index creation when `DATABASE_URL` uses a pooler |
| `AUTH_SECRET` | 32+ random bytes — sessions, order tokens, 2FA encryption |
| `STORAGE_DRIVER` | `local` (dev) or `s3` (**required in production**) |
| `STORAGE_BUCKET/ENDPOINT/ACCESS_KEY/SECRET_KEY/PUBLIC_HOST` | S3-compatible storage |
| `EMAIL_PROVIDER/SMS_PROVIDER/WHATSAPP_PROVIDER` | `resend` / `twilio` / `meta`, or `console` (log only) |
| `META_PIXEL_ID` | Optional server-side Meta Conversions API identifier |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Optional distributed rate limiting; production falls back to shared PostgreSQL buckets, while memory fallback is development/test only |
| `TRUSTED_CLIENT_IP_HEADER` | Header overwritten by the trusted reverse proxy (default `x-real-ip`); required for production public mutation rate limits |
| `ORDER_OUTBOX_SECRET` | 32+ random bytes used only by the scheduled order-effect retry endpoint; required in production |

Never commit `.env`.

In production, configure a scheduler to `POST /api/internal/order-outbox` at least once per minute with `Authorization: Bearer $ORDER_OUTBOX_SECRET`. Order analytics, customer notifications, and Meta conversion events are durably enqueued in the same transaction as the order; the scheduler retries pending effects with bounded exponential backoff. The order request also attempts immediate processing after its response.

Also schedule `POST /api/internal/retention` daily with `Authorization: Bearer $RETENTION_JOB_SECRET`. It expires technical sessions, abandons stale carts, removes expired idempotency/rate-limit records, and applies the configured analytics/notification/outbox retention windows. Orders and audit logs are never deleted by this job.

After a staging or production deployment, run `BASE_URL=https://your-store.example RETENTION_JOB_SECRET=... npm run smoke:production` to verify storefront readiness, a known product route, missing-product `404` behavior, and retention endpoint authorization.

## Architecture

```
src/
  app/
    (store)/            # public storefront (server components + islands)
    admin/              # back office (login, first-login, (dashboard)/*)
    api/admin/*         # upload, CSV exports, order alerts (session-guarded)
    sitemap.ts robots.ts
  components/
    ui.tsx              # design-system primitives
    pagination.tsx      # server pagination
    storefront/         # chrome, cart, product, home, catalog UI
    admin/              # shell (sidebar/alerts), shared widgets, product editor
  config/brand.ts       # centralized brand config (env-overridable)
  lib/                  # prisma, auth, rbac, phone, money, validation, settings,
                        #  storage, notifications, rate-limit, audit, csrf, totp
  server/               # domain services: catalog, cart, orders, coupons,
                        #  inventory, delivery, risk, analytics, navigation
    actions/            # server actions (storefront + admin)
prisma/
  schema.prisma         # full data model
  migrations/           # SQL migrations (apply with `prisma migrate deploy`)
  seed.ts               # idempotent seed (safe to re-run)
  data/algeria_cities.json  # public wilaya/commune dataset (source: othmanus/algeria-cities)
```

### Key flows

**Checkout (`src/server/orders.ts`)** — one Prisma transaction:
validate customer/phone → validate wilaya + commune pairing → reload every
variant from the DB → conditional atomic stock decrement (concurrent checkouts
can never oversell) → delivery priced from `DeliveryRate` → coupon validated
server-side → free-shipping threshold → unique order number from a `Counter`
(`PREFIX-YYYY-000001`) → order + snapshots + status history → coupon
redemption → cart conversion → audit. Idempotency keys make double-clicks safe;
recent same-phone/same-total orders trigger a confirm step, not a silent block.
Notifications (email/SMS/WhatsApp) and analytics fire **after commit** and can
never roll an order back.

**Risk scoring (`src/server/risk.ts`)** — repeat/bad-history, frequency, value
anomalies and shared phones produce `LOW/MEDIUM/HIGH` review flags. The system
never auto-rejects a customer.

**Sessions** — opaque 256-bit tokens, SHA-256-hashed in the DB, HTTP-only
`SameSite=Lax` cookies. Staff sessions expire in 7 days, customer sessions in
30. Role-based permissions gate every admin action server-side.

**Inventory strategy (COD)** — stock is decremented atomically at order creation
(Option B) and restored on cancellation/return, with every movement logged in
`InventoryTransaction`. Concurrent checkouts for the last unit cannot oversell:
the conditional update matches zero rows and the second order fails cleanly.

**Meta Conversions API** — when `META_PIXEL_ID` + `META_CONVERSIONS_API_KEY`
are set, a server-side `Purchase` event fires after each order (PII hashed).
It shares `event_id` with the browser pixel (`purchase-<orderNumber>`) so Meta
deduplicates instead of double-counting.

## Admin guide

| Area | Path |
| ---- | ---- |
| Dashboard, analytics | `/admin`, `/admin/analytics` |
| Orders (filter/search/status/notes/print/CSV) | `/admin/orders` |
| Products, categories, collections, inventory | `/admin/products…` |
| Coupons, promotions, delivery rates (CSV import/export) | `/admin/coupons`, `/admin/promotions`, `/admin/delivery` |
| Customers, reviews, messages, newsletter | `/admin/customers…` |
| Pages, FAQ, announcements, settings, staff, audit | `/admin/content…` |

Staff roles: `SUPER_ADMIN, ADMIN, ORDER_MANAGER, PRODUCT_MANAGER,
CUSTOMER_SUPPORT, ANALYST` — each with a least-privilege permission set
(`src/lib/auth/permissions.ts`).

## Promotions (flash sales)

**Admin → Promotions**: automatic, code-less discounts with a server-clocked
time window and optional collection/product scope. The single best applicable
promotion wins and never stacks; percentages are hard-capped at 90%.
Evaluated inside the order transaction *before* coupons (coupons apply to the
remainder). Every order stores `promotionId + promotionDiscount`, shown on the
confirmation page, admin detail, print slip and CSV export. Product pages
display an informational badge while a promotion covers them.

## Delivery setup

1. Review **Admin → Delivery**: every wilaya has Home/Stopdesk/Express/Standard
   rates with ETAs. Seed values are **placeholders** — confirm them with your
   carrier (Yalidine/Maystro/etc.) or bulk-update via CSV import.
2. `Checkout` reads prices only from `DeliveryRate`; communes are constrained
   to the selected wilaya.

## Notifications

`src/lib/notifications.ts` defines provider interfaces. Without credentials,
events are recorded in the `Notification` table and logged (console) so flows
stay intact. Add Resend/Twilio/Meta credentials to send real email/SMS/WhatsApp.

## Backups & disaster recovery

Use your provider's automated backups (example: daily pg_dump / PITR with
7–30 day retention):

```bash
pg_dump "$DATABASE_URL" -Fc -f "backup-$(date +%F).dump"
pg_restore -d "$DATABASE_URL" backup-2026-01-01.dump
```

Uploads live in object storage — enable bucket versioning/replication there.
Test restores on a staging database before you need them.

## Security posture

- Argon2id hashing, password policy, atomic five-failure admin login lockout
  (15-minute lockout) + rate limits, TOTP 2FA
  (encrypted secrets), forced password rotation for seeded accounts
- CSRF: SameSite cookies + server-action origin checks + explicit origin check
  on mutating routes · strict CSP/HSTS/security headers (`next.config.ts`)
- Uploads: MIME + signature validation via sharp, 8 MB cap, WebP re-encode,
  metadata strip, safe filenames, no execution
- Validation with Zod on every boundary; HTML sanitized with an allow-list;
  stack traces never leak to customers; audit log is append-only
- Secrets only in env; `.env.example` ships without credentials

## 2026-10-05 security remediation report

The repository-wide review and remediation pass covered authentication,
authorization, checkout pricing, inventory, order transitions, notifications,
uploads, database boundaries, API routes, and production configuration. The
full line-referenced report is maintained in
[`CODE_REVIEW_2026-10-05.md`](./CODE_REVIEW_2026-10-05.md).

The five tracked findings were addressed as follows:

1. **Admin lockout:** failed login counters now atomically transition an active
   account to `LOCKED` on the fifth failure for 15 minutes; successful login
   resets the counter.
2. **Runtime action validation:** shared Zod schemas validate IDs, enums,
   pagination, searches, dates, and order filters at server-action boundaries.
3. **Inventory integrity:** absolute stock edits take a PostgreSQL transaction
   advisory lock per variant, so audit deltas match serialized writes.
4. **Outbox delivery:** stable event keys are passed to notification providers;
   Resend receives its native `Idempotency-Key`, while other providers receive
   the stable key for adapter-level deduplication and tracing.
5. **Development dependency advisory:** the depth-guarded `braces` package is
   vendored and pinned through npm overrides, avoiding the vulnerable parser
   without downgrading Next.js. Production dependencies remain audit-clean.

### Admin action schemas

All permission-gated admin actions treat their arguments as untrusted remote
input. The reusable schemas in
[`src/lib/validation/admin.ts`](./src/lib/validation/admin.ts) cover IDs,
product and order statuses, customer/message statuses, bounded pagination and
search, inventory/product lists, audit-log filters, delivery CSV size, customer
notes, settings keys/objects, and order export filters. Action-specific form
schemas remain beside their actions when the input has domain-specific rules.

Each action must call `safeParse()` after `requirePermission()` and before any
Prisma query or mutation. Invalid list/filter input returns a bounded empty
result; invalid mutations return a controlled error object (or an `AppError`
for read lookups), never a raw Prisma validation exception. When adding a new
admin action, extend the shared schema module or add a local Zod schema and add
malformed-input coverage to the test suite.

Before deployment, run `npm ci`, `npm run typecheck`, `npm run lint`,
`npm test`, `npm audit --omit=dev`, and `npm run build`.

### Vercel staging and production

The linked Vercel project is `josefinee-store`. The `staging` branch is the
Preview/staging source, and `main` is the production source. Vercel Preview
deployments are enabled for staging. The `Promote staging to production`
workflow runs only after the all-push `CI/CD` workflow succeeds for staging;
it verifies that the branch has not advanced since the tested commit, opens or
reuses a staging-to-main pull request, and enables automatic squash merge.
Merging `main` then triggers Vercel's linked Git integration to deploy the
tested commit to the production domains.

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev / build / start` | develop / build / run production |
| `npm run typecheck / lint / test` | `tsc --noEmit` / ESLint / Vitest |
| `npm run db:generate / db:migrate / db:deploy / db:seed / db:studio` | Prisma workflows |

## Production checklist

- [ ] Real `AUTH_SECRET`, `DATABASE_URL`, `APP_URL`
- [ ] `STORAGE_DRIVER=s3` with a public bucket hostname
- [ ] Real delivery rates + free-shipping threshold
- [ ] Brand settings (name, logo, socials, legal pages) via Admin → Settings/Content
- [ ] Notification providers + analytics IDs
- [ ] Staff accounts created, demo admin disabled, 2FA enabled
- [ ] Backups scheduled and restore tested


## Safe database deployment

For existing databases, use `npm run db:deploy` rather than invoking `prisma migrate deploy` directly. It verifies and creates the FK lookup indexes with `CREATE INDEX CONCURRENTLY` before Prisma applies migrations; the migration itself uses `IF NOT EXISTS` as a safe fallback. If `DATABASE_URL` points through a transaction pooler, set `DIRECT_URL` to the provider's direct PostgreSQL connection for the online-index step. On a fresh database, the runner skips tables/columns that do not exist yet, and the migration creates the indexes after the schema is established.
