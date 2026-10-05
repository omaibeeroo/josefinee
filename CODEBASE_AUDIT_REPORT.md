# Josefinee Codebase Audit & Cleanup Report

**Audit date:** 5 October 2026  
**Repository:** `omaibeeroo/josefinee`  
**Working branch:** `manus/codebase-cleanup`  
**Base branch:** `manus/premium-motion-ui`  
**Base commit:** `97726976147094cea38db0f34099ed11a37be9e0`

## Executive summary

A repository-wide static audit and cleanup pass was completed across the Next.js application, server actions, API routes, Prisma layer, tests, configuration, and package metadata.

The cleanup was intentionally conservative for a production commerce system. Only changes supported by direct repository evidence were applied:

- Removed confirmed internal-only exports and dead utility functions.
- Removed an orphaned homepage editorial component that had no call sites.
- Removed an unused upload filename parameter.
- Removed unnecessary user-supplied filename data from upload audit metadata.
- Sanitized raw operational error logging so database/provider/request error objects are not written to production logs.
- Removed customer notification recipients and subjects from console fallback logs.
- Preserved intentional test infrastructure and configuration-backed dependencies.
- Updated the audit regression test for the sanitized logging contract.

All required validation passes after cleanup:

| Check | Result |
|---|---|
| TypeScript typecheck | **Passed** |
| ESLint | **Passed** |
| Vitest | **Passed — 14 files, 77 tests** |
| Next.js production build | **Passed — 19 static routes generated** |
| Production dependency audit | **Passed — 0 vulnerabilities** |
| Git whitespace check | **Passed** |

No Vercel settings, credentials, database schema, migrations, checkout pricing logic, inventory logic, or production branch were changed by this cleanup pass.

---

## 1. Repository state at audit start

The working tree was on the previous UI branch with one existing untracked report:

```text
manus/premium-motion-ui...origin/manus/premium-motion-ui
?? POST_DEPLOYMENT_REPORT.md
```

A dedicated cleanup branch was created:

```text
manus/codebase-cleanup
```

The existing `POST_DEPLOYMENT_REPORT.md` was preserved and was not deleted or rewritten.

### Repository structure reviewed

- `src/app/(store)` — storefront pages, customer account, checkout, search, catalog and content routes.
- `src/app/admin` — staff login, first-login flow and admin dashboard.
- `src/app/api` — protected admin exports/uploads, internal jobs, and CSP reporting.
- `src/components` — storefront, admin and shared UI components.
- `src/config` — brand and production-environment validation.
- `src/lib` — authentication, authorization, money, validation, storage, notifications, rate limiting, audit, CSRF and security helpers.
- `src/server` — catalog, cart, pricing, orders, inventory, promotions, delivery, analytics, risk, retention and outbox services.
- `src/server/actions` — customer and admin server actions.
- `prisma` — schema, migrations, seed and Algeria wilaya/commune dataset.
- `.github/workflows` — CI validation pipeline.

The source, route, server-action and Prisma references were mapped before editing. No orphaned page route or API endpoint was confirmed.

---

## 2. Cleanup changes implemented

### 2.1 Removed internal-only export modifiers

Several functions, constants and types were marked `export` even though all call sites were inside their defining module. Their visibility was narrowed without changing runtime behavior.

Affected areas include:

- Storefront pixels, catalog filters, skeletons and product controls.
- Auth cookies and internal rate-limit helpers.
- Internal permission constants and transition maps.
- Validation schemas used only by their parent schema.
- Catalog mapping/query helpers.
- Promotion lookup helpers.
- Internal settings, notification, editor and action result types.

The public/exported contract was retained where cross-module consumers exist, including:

- `PERMISSIONS` from `src/lib/auth/permissions.ts`.
- `ROLE_PERMISSIONS` and `ROLES` used by runtime and Prisma seed code.
- `StoreProductCard` and catalog types used by other storefront modules.
- `ProductInput` and public validation schemas used by admin actions.
- `PermissionCode` used by RBAC authorization signatures.

### 2.2 Removed confirmed dead code

The following code had no call sites and was removed:

- `chunk()` and `unique()` from `src/lib/utils.ts`.
- The unused `Editorial` component from `src/components/storefront/home.tsx`.
- The unused `zInt` schema from `src/lib/validation/common.ts`.
- The unused `ActionResult` type from `src/server/actions/cart.ts`.
- The unused `BrandConfig` type alias.
- The unused homepage `StoreProductCard` re-export.

### 2.3 Removed an unused upload input

`storeImage()` accepted a `filename` field but never used it to generate a storage key or process the image. The field was removed from the internal upload contract.

The upload route no longer passes `file.name` to storage.

### 2.4 Reduced audit metadata exposure

The admin upload audit event previously recorded the user-supplied filename. Filenames are not required to reconstruct the upload event and can contain personal or path-like information.

The audit metadata now records only:

```text
size
mimeType
```

The stored object key and returned public URL remain available through the normal upload response.

### 2.5 Sanitized operational error logs

Raw error objects were removed from logs in catalog, cart, delivery, navigation, order lookup, checkout, contact, newsletter, admin order/catalog, upload, sitemap, home, audit and related paths.

Logs now record the error class name only, for example:

```ts
console.error("[upload] failed", error instanceof Error ? error.name : "unknown");
```

This preserves high-level diagnostics while avoiding accidental logging of:

- Database connection details.
- Provider response bodies.
- Request payloads.
- File-system paths.
- Internal stack details.
- Secret-bearing error messages.

### 2.6 Removed notification recipient leakage from console fallback

The console notification provider previously printed the destination and subject:

```text
[notify:email] -> customer@example.com :: Order received
```

It now prints only a safe operational marker:

```text
[notify:email] console provider selected
```

Notification records remain persisted in the database as designed, and configured real providers continue to receive their normal message payloads.

---

## 3. Confirmed non-issues retained intentionally

### Test-only `server-only` stub

Knip reports `src/test/stubs/server-only.ts` as unused because its usage is indirect through the Vitest alias configuration:

```ts
"server-only": path.resolve(__dirname, "src/test/stubs/server-only.ts")
```

It is required by tests importing server modules and must remain.

### `eslint-config-next`

Knip reports `eslint-config-next` as unused because it is referenced by string name through ESLint `FlatCompat`:

```js
compat.extends("next/core-web-vitals", "next/typescript")
```

It is a valid configuration dependency and must remain.

### Operational logs

Not every log was removed. Seed progress logs, deployment/job failure markers, CSP development diagnostics and sanitized provider error markers are intentional operational behavior. Removing them would reduce observability without reducing security.

### Database schema and migrations

No Prisma models, columns, indexes or applied migrations were removed. No schema change was necessary for the confirmed cleanup findings.

### Checkout and pricing logic

No changes were made to the authoritative checkout transaction, price recalculation, promotion/coupon ordering, delivery calculation, coupon usage, idempotency or inventory decrement logic.

---

## 4. Security observations

### Positive findings

- No tracked production `.env` file.
- `.env` and deployment artifacts remain ignored.
- No GitHub PAT, Vercel token, storage secret, private key, or AWS-style access key was introduced by the cleanup.
- Upload validation still performs MIME allowlisting, content decoding, image re-encoding, size checks and metadata stripping.
- Server-only storage access remains server-side.
- Audit failures remain non-blocking for business operations, but their logs no longer expose raw error objects.
- Notification fallback logs no longer expose customer recipient data.
- Existing permission-based RBAC and audit logging were preserved.

### Outstanding security items outside this cleanup

These were observed in the inherited project state but intentionally not changed because they require external credentials or operational authority:

1. Vercel still needs provider-side rotation and Sensitive/Secret classification for the storage access and secret keys.
2. Preview and Production currently share storage variable targets; separate preview storage credentials or removal of Preview storage access is recommended.
3. Production maintenance mode remains enabled until launch readiness is confirmed.
4. Custom-domain DNS should be verified before public launch.
5. Real staff accounts should replace or disable demo credentials, with MFA enabled.

---

## 5. Validation evidence

### TypeScript, lint and tests

Commands:

```bash
npm run typecheck
npm run lint
npm run test -- --run
```

Results:

```text
Typecheck: passed
Lint: passed
Test Files: 14 passed
Tests: 77 passed
```

The test runner emits a non-blocking Vite warning about a future `configLoader: "native"` default. It does not affect the current test result.

### Production build

Command:

```bash
APP_URL=https://josefinee-cleanup-preview.example.com npm run build
```

Results:

- Prisma Client generation: passed.
- Next.js compilation: passed.
- Build-time lint and type validation: passed.
- Page-data collection: passed.
- Static page generation: passed, `19/19`.
- Build trace collection: passed.
- Route optimization: passed.

The build emits the existing Prisma 7 deprecation warning for the `package.json#prisma` seed configuration. This is a future-maintenance item, not a current failure.

### Dependency security

Command:

```bash
npm audit --omit=dev --audit-level=high
```

Result:

```text
found 0 vulnerabilities
```

The installed tree contains transitive native/wasm packages associated with Sharp and other tooling. They are not direct manifest dependencies and were not manually removed.

### Code hygiene

- `git diff --check`: passed.
- No raw notification recipient/subject logging remains.
- No raw error-object logging remains in the reviewed server paths.
- No secret-like content was introduced into the diff.

---

## 6. Current project health

| Area | Current state |
|---|---|
| Application compilation | Healthy |
| TypeScript strictness | Passing |
| ESLint | Passing |
| Unit/pure-logic tests | 77 passing |
| Production build | Passing |
| Runtime dependency vulnerabilities | 0 high-or-greater findings |
| Checkout integrity | Previously implemented and preserved |
| Inventory atomicity | Previously implemented and preserved |
| Admin RBAC | Previously implemented and preserved |
| Audit trail | Preserved and log output hardened |
| Storage runtime code | Preserved; upload contract simplified |
| Vercel storage secret classification | Still requires external/provider action |
| Public production storefront | Previously configured for maintenance mode |
| Custom domain DNS | Requires operational verification |

---

## 7. Recommended next steps

### Immediate

1. Review the cleanup diff on `manus/codebase-cleanup`.
2. Push the branch and open a pull request for review.
3. Merge only after the CI workflow passes on the branch.

### Before public launch

1. Rotate object-storage credentials at the storage provider.
2. Store the new values in Vercel as Sensitive/Secret variables.
3. Separate Preview and Production storage credentials or remove Preview storage access.
4. Redeploy and test one authenticated admin image upload.
5. Disable `PUBLIC_SITE_MAINTENANCE` only when launch is approved.
6. Rerun the complete production storefront, account, checkout, robots and sitemap smoke suite.
7. Verify custom-domain DNS and HTTPS.
8. Create real staff accounts, enable MFA and disable development/demo admin credentials.
9. Confirm carrier delivery rates, notification providers and backups.

### Future code-maintenance items

- Migrate Prisma seed configuration from `package.json#prisma` to `prisma.config.ts` before Prisma 7.
- Consider converting `vitest.config.ts` to an ESM-compatible extension or explicitly suppressing the Vite native-loader warning.
- Add a supported Knip configuration for config-referenced dependencies and aliases if unused-code scanning becomes a CI gate.
- Consider a structured server logger with environment-aware levels if centralized observability is introduced.

## Conclusion

The repository is in a healthy, validated state after the cleanup pass. The codebase has fewer unnecessary exports and utilities, a smaller storefront module surface, no confirmed orphaned routes, safer production log behavior, and no high-severity dependency vulnerabilities.

The remaining risks are deployment and operational configuration items—especially storage-key rotation/classification, Preview isolation, maintenance-mode release readiness and custom-domain DNS—not unresolved compilation or application-logic failures.
