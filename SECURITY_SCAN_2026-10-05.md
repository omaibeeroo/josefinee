# Hanadi Store Main-Branch Security Scan

**Repository:** `omaibeeroo/josefinee`  
**Branch/commit:** `main` / `4e5837e` (`Merge security remediation fixes`)  
**Scan date:** 2026-10-05  
**Source working tree:** clean and synchronized with `origin/main` before this report was generated

## Executive result

The five remediation areas merged in pull request #23 are present on `main` and the primary security checks pass. No production dependency vulnerabilities, tracked credentials, unsafe shell execution, unsafe raw SQL interpolation, or obvious cache leaks were found.

This scan cannot certify that the application is “fully secure” in an absolute sense. GitHub-native code/dependency/secret scanning is disabled or inaccessible for this repository; the application-level runtime-schema follow-up identified by the scan has since been completed.

## Verified controls

| Area | Result | Evidence |
|---|---|---|
| Branch integrity | Pass | `main` and `origin/main` both at `4e5837e`; clean working tree |
| Production dependencies | Pass | `npm audit --omit=dev`: 0 vulnerabilities |
| Original `braces` advisory | Pass | `braces` absent from full audit vulnerability map; depth-guard tests pass |
| Full development audit | Partial | 5 unrelated transitive dev-tool findings remain: `debug`, `diff`, `js-yaml`, `minimatch`, `mocha` |
| Targeted security tests | Pass | 5 files, 25 tests passed |
| Dangerous execution scan | Pass | No `eval`, `new Function`, `child_process`, `spawn`, or unsafe shell APIs in application code |
| SQL injection scan | Pass | No `$queryRawUnsafe` or `$executeRawUnsafe`; raw SQL uses Prisma tagged templates |
| Secret scan | Pass locally | Only `.env.example` is tracked; no PEM/key/credential files found |
| HTML sinks | Pass on manual review | Rich text is sanitized; JSON-LD uses safe serialization; print script is fixed and nonce-protected |
| API caching | Pass on reviewed routes | Admin/internal responses use `no-store`; sensitive pages are dynamic |
| Build | Pass | Production compilation, type validation, and route generation completed |

## Remediation verification

### Admin lockout

`src/server/actions/admin-auth.ts` now performs an atomic SQL update. The fifth failed attempt changes an active user to `LOCKED` and sets a 15-minute `lockedUntil` timestamp. Successful login and administrative reset paths clear the failed counter and lock timestamp.

### Runtime boundary validation

Shared schemas in `src/lib/validation/admin.ts` are used by reviewed staff, catalog, customer, message, review, and order actions. Order filters now validate status, risk, IDs, search, dates, and page bounds before Prisma query construction.

### Inventory concurrency

`src/server/inventory.ts:setStock()` takes a PostgreSQL transaction advisory lock keyed by the variant ID before reading the current stock and calculating the audit delta. This prevents concurrent absolute edits from recording stale deltas.

### Outbox idempotency

Outbox notification sends use stable event-derived keys. Resend receives its native `Idempotency-Key`; SMS/WhatsApp adapters receive stable tracing/deduplication headers. The event uniqueness constraint remains in place.

### Development dependency hardening

The depth-guarded package under `vendor/braces` is pinned through `package.json` and the lockfile. `src/server/braces-depth-security.test.ts` passes, and the original `braces` entry is absent from the audit vulnerability map. Production dependencies remain clean.

## Residual findings

### R1 — GitHub native security alerts are unavailable

GitHub API checks report that code scanning is not enabled, Dependabot alerts are disabled, and secret-scanning alerts are inaccessible to the configured integration. Local scanning therefore cannot substitute for repository-level alerting.

**Recommendation:** enable GitHub CodeQL/code scanning, Dependabot alerts, and secret scanning/push protection in repository settings. This is an operational control, not an application-code defect.

### R2 — Some admin actions still lack explicit runtime schemas — Resolved

A follow-up implementation added explicit schemas for the previously flagged permission-gated actions:

- `src/server/actions/admin-catalog.ts:24` — `listAdminProducts`;
- `src/server/actions/admin-catalog.ts:83` — `getProductForEdit`;
- `src/server/actions/admin-inventory.ts:12` — `listInventory`;
- `src/server/actions/admin-ops.ts:212` — `deleteCouponAction`;
- `src/server/actions/admin-ops.ts:291` — `importDeliveryCsvAction`;
- `src/server/actions/admin-ops.ts:485` — `updateCustomerNotesAction`;
- `src/server/actions/admin-ops.ts:724` — `deleteAnnouncementAction`;
- `src/server/actions/admin-ops.ts:739` — `saveSettingsAction`;
- `src/server/actions/admin-ops.ts:888` — `deletePromotionAction`;
- `src/server/actions/admin-ops.ts:908` — `listAuditLogs`;
- `src/server/actions/admin-orders.ts:263` — `exportOrdersCsv`.

The actions remain behind RBAC and now validate IDs, bounded pagination/search filters, CSV size, settings keys/objects, audit filters, and order export filters before database work. Typecheck, lint, all 81 tests, and whitespace checks pass after the change.

## Conclusion

**Security posture: materially improved and acceptable for a controlled deployment, but not fully verified as secure.** The five merged fixes and the remaining admin runtime schemas are present and pass the available local checks. The remaining operational recommendation is to enable GitHub’s native scanning features.
