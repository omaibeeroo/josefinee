# CI and software-supply-chain policy

This policy is the release gate for dependency and CI supply-chain controls. It applies to runtime, development, build, and test dependencies, the npm lockfile, and every GitHub Action used by the repository.

## Required checks

The `CI/CD` workflow must remain green before merge or release. It preserves the existing install, migration, seed, typecheck, lint, test, build, standalone packaging, and HTTP smoke-test jobs, and additionally:

- Runs `npm audit --include=dev --audit-level=high`. The explicit `include=dev` is intentional: vulnerabilities in development, build, and test tooling are reviewed rather than omitted.
- Generates a CycloneDX JSON SBOM with the pinned Anchore SBOM Action and retains it as a workflow artifact for 14 days. The SBOM is evidence for the exact installed dependency tree used by CI.
- Runs dependency review on pull requests. High and critical dependency findings fail the check.
- Runs CodeQL SAST for JavaScript and TypeScript on pushes, pull requests, and the weekly scheduled scan.
- Runs Gitleaks against full repository history on pushes, pull requests, and the weekly scheduled scan. A detected committed secret fails the check.
- Uses Dependabot for both npm dependencies and GitHub Actions. Action references are immutable full commit SHAs with the human-readable release tag recorded in a nearby comment; Dependabot PRs must preserve that convention.

## Severity thresholds

The default automated threshold is **high or critical is blocking**. A low or moderate npm advisory is not silently ignored: it must still be reviewed, tracked, and upgraded when a safe fix is available. A CodeQL result classified as an error/high-confidence security issue and any Gitleaks finding are blocking regardless of the npm advisory threshold.

A passing workflow is not, by itself, proof that repository security settings are enabled. Required status checks, branch protection, GitHub Advanced Security/CodeQL alert enforcement, secret-scanning push protection, and Dependabot alert activation require repository-owner configuration outside these files. Organization-owned repositories must also configure the encrypted `GITLEAKS_LICENSE` secret; personal repositories may leave it unset.

## Exception process

Exceptions are rare, explicit, and time-bound. Before merging with a blocking finding, create or update a tracked security issue containing:

1. The advisory or finding identifier, package/action and exact version/SHA, affected path, and evidence from the CI run.
2. Impact assessment and why immediate remediation is not safe or available.
3. A named engineering owner, compensating controls, and a concrete remediation date.
4. Approval from the security/release owner and an expiry date. High/critical exceptions expire within 30 days unless re-approved with new evidence; secret findings require removal/rotation and are not waived merely because the value appears unused.

The issue must be linked from the pull request/release record. Do not add a permanent audit allowlist, downgrade severity to make a check pass, or disable a scanner. At expiry, CI must return to a blocking state or the exception must be re-approved with updated justification.

## Release evidence and ownership

For each release, retain the CI run URL, npm audit result, SBOM artifact, CodeQL/Gitleaks results, and any approved exception issue. The release owner is responsible for reviewing findings; the security owner approves exceptions; the repository owner configures required checks and branch protection. Production deployment, rollback, backup restoration, and live security verification remain separate operational gates.
