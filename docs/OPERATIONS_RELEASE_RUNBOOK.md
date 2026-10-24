# Hanadi Store — Provider-neutral release and operations runbook

This runbook is a repository control, not production evidence. Execute the commands below only against an isolated staging target unless a named owner has separately approved a production operation. Never paste secret values, customer data, or provider credentials into logs or pull requests.

## Release identity and promotion

1. Record the exact 40-character commit SHA in the release ticket and in `docs/AUDIT_RELEASE_GATE.md`.
2. Run `npm ci --include=dev`, `npm run validate:migrations`, `npm run typecheck`, `npm run lint`, `npm test`, `npm audit --include=dev --audit-level=high`, and `npm run build` from that SHA.
3. Before deploying to Preview, verify the Preview database and object-storage resources are separate from Production. On 2026-10-24, the Vercel environment-variable metadata showed the same `DATABASE_URL` record and shared storage targets for Preview and Production, with no staging-branch override. Until the owner provisions and verifies isolated Preview resources, do not advance `staging`, run staging readiness, authenticate as admin in Preview, or perform Preview writes. Builds with the new middleware block all routes with `503` until the Vercel Preview variable `HANADI_PREVIEW_DATA_ISOLATION_CONFIRMED=true` is set; the readiness and promotion workflows also require the GitHub repository variable of the same name to be `true`. The existing older Preview deployment predates that code and must be protected or retired in Vercel until a guarded deployment is active. Set both flags only after recording sanitized owner verification of isolated resources.
4. After isolation is verified, deploy that same SHA from `staging` to Vercel Preview. `.github/workflows/staging-readiness.yml` accepts only a successful `Preview` deployment whose SHA still equals the current `staging` ref, checks out that exact commit, runs the host-restricted read-only deployment smoke, and publishes a `Staging readiness` check against the tested SHA. Promotion also requires successful exact-SHA CI, the latest matching Preview deployment and readiness check, and configured protected review. Workflow presence alone is not staging evidence; retain the actual deployment and check-run URLs.
5. Exercise backward-compatible migration rehearsal with the previous app version still serving. Capture the migration command output, duration, lock/connection observations, and rollback decision in a sanitized evidence record.
6. Open the staging-to-main pull request. Do not bypass branch protection: the promotion workflow reads the repository's actual required-review configuration and merges only after an explicit approved review. If the protection API is unavailable, promotion stops.
7. After the production deployment reports success, `production-smoke.yml` checks only liveness, route behavior, maintenance signaling, unauthorized internal-route rejection, and security headers. It checks out the deployment SHA and never sends an authorized retention request.

## Maintenance-only provider exception

`PUBLIC_SITE_MAINTENANCE=true` intentionally returns `503` for public routes and allows admin startup when notification provider variables or credentials are missing. This exception exists only to preserve operator access while the store is closed: missing/incomplete configuration and a `console` placeholder fail definitively and are never sent to the console provider. Unknown provider names remain invalid in Production, and `console` is blocked when maintenance is off. Do not disable maintenance or accept public traffic until the real providers, sender identities, delivery/retry monitoring, and controlled test-order evidence in the release gate are complete.

## Database migration safety (H7)

`npm run validate:migrations` is a repository-only gate. It verifies deterministic migration names, the presence of `migration.sql`, and rejects detected destructive SQL (`DROP`, `TRUNCATE`, direct `DELETE`, and in-place type changes); a comment in the migration cannot approve itself. Prefer expand/contract changes: add nullable/schema-compatible structures, deploy code that can read both shapes, backfill in bounded batches, switch reads/writes, and remove old structures only in a separately reviewed change.

Use `npm run db:deploy` for an explicitly approved target. It runs the online-index helper before Prisma migration deployment. **This repository does not yet enforce that the Vercel Production deployment runs `db:deploy` before application activation. Do not release to Production until the provider owner wires and rehearses that exact pre-deploy migration step.** Do not run `prisma migrate reset`, `db push`, or production migrations from smoke jobs. Do not edit an applied migration; create a new migration and retain its checksum.

## Retention validation

Production deployment smoke intentionally performs no authorized retention call and receives no retention secret. The authorized `POST /api/internal/retention` is tested only by `npm run smoke:production` in CI, against an HTTP loopback standalone server connected to CI's disposable PostgreSQL service; the script refuses non-CI/non-loopback runs and requires a test-only secret. Never pass a production retention secret to a deployment-event workflow or a caller-supplied URL. Do not run the authorized purge against local, shared staging, or production data.

## Backup and restore rehearsal (H9)

A provider owner must document the backup product, encryption/access policy, retention window, expected RPO/RTO, and the immutable backup identifier. Restore into a new isolated database or project; never overwrite production. Run `npm run db:deploy` against the restored target, start the exact release artifact, execute non-destructive health and read-only checks, and record row-count/data-integrity comparisons. Destroy the rehearsal target according to provider policy. A backup configuration without a successful restore record is not a passed gate.

## Rollback and migration recovery

Record the previous production artifact SHA and database migration state before promotion. If the new app is unhealthy, stop traffic or enter maintenance through the provider control plane, preserve logs, and roll back the application only when the schema remains backward-compatible. Do not roll back across an irreversible migration. For migration failure, follow the migration owner's tested forward-fix or restore procedure; never improvise SQL against production. Record decision time, owner, maximum rollback window, and final verification.

## Monitoring, jobs, and incident response

Before release, identify dashboards and alerts for 5xx rate, checkout/order failures, negative-stock attempts, outbox/notification backlog and retries, retention failures, database errors/saturation, latency, and repeated admin authentication failures. For each alert record threshold, deduplication, escalation path, and a test-fire result. Retention and outbox schedules need a named owner, bounded/idempotent execution, missed-run alerting, and backlog-age visibility. Record primary/backup on-call, release/security/database/storage/notification owners and reachable escalation contacts. These are owner-controlled gates and must remain unchecked until evidence exists.

## Required sanitized evidence

Attach links or IDs for the exact-SHA CI run, staging deployment/readiness, migration rehearsal, backup restore, rollback rehearsal, monitoring test fire, job backlog/ownership, production smoke, real-device checks, and legal/privacy review. Never infer provider guarantees, delivery, restore success, rollback safety, or legal approval from repository files alone.
