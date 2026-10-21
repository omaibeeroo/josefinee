import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("deployment safety controls", () => {
  it("keeps production smoke non-mutating, SHA-pinned, and host-restricted", () => {
    const deploymentSmoke = read("scripts/smoke-production-deployment.sh");
    const localSmoke = read("scripts/smoke-production.sh");
    const workflow = read(".github/workflows/production-smoke.yml");

    expect(deploymentSmoke).toContain("EXPECTED_DEPLOYMENT_SHA");
    expect(deploymentSmoke).toContain("git rev-parse HEAD");
    expect(deploymentSmoke).toContain("hanadistore.vercel.app");
    expect(deploymentSmoke).toContain("josefinee-store-");
    expect(deploymentSmoke).not.toContain("RETENTION_JOB_SECRET");
    expect(deploymentSmoke).not.toContain("Authorization: Bearer");
    expect(deploymentSmoke).toContain('expect_status 200 "admin login page"');
    expect(deploymentSmoke).toContain('expect_status 307 "unauthenticated admin redirect"');
    expect(workflow).toContain("ref: ${{ github.event.deployment.sha }}");
    expect(workflow).toContain("EXPECTED_DEPLOYMENT_SHA: ${{ github.event.deployment.sha }}");
    expect(workflow).not.toContain("RETENTION_JOB_SECRET");

    // The destructive authenticated probe exists only in the standalone CI
    // smoke and is fenced to an HTTP loopback server with a test-only secret.
    expect(localSmoke).toContain("RETENTION_JOB_SECRET");
    expect(localSmoke).toContain('"${CI:-}" != "true"');
    expect(localSmoke).toContain('url.protocol !== "http:"');
    expect(localSmoke).toContain('"127.0.0.1"');
    expect(localSmoke).toContain('expect_status 200 "admin login page"');
    expect(localSmoke).toContain('expect_status 307 "unauthenticated admin redirect"');
    expect(localSmoke).toContain('"Authorization: Bearer $RETENTION_JOB_SECRET"');
    expect(localSmoke).toContain('"authorized disposable-database retention request"');

    // Never send a destructive-operation credential to a caller-supplied URL.
    expect(existsSync(resolve(root, ".github/workflows/retention-staging-validation.yml"))).toBe(
      false,
    );
    expect(existsSync(resolve(root, "scripts/validate-retention-staging.sh"))).toBe(false);
  });

  it("requires readiness and protected approval before promotion", () => {
    const workflow = read(".github/workflows/promote-staging.yml");

    expect(workflow).toContain("deployments?sha=${TESTED_SHA}&environment=staging");
    expect(workflow).toContain('name == "Staging readiness"');
    expect(workflow).toContain("required_pull_request_reviews");
    expect(workflow).toContain('decision" != "APPROVED"');
    expect(workflow).not.toContain("--auto");
  });

  it("runs a fail-closed migration validator in CI without self-approval comments", () => {
    const packageJson = read("package.json");
    const workflow = read(".github/workflows/ci.yml");
    const validator = read("scripts/validate-migration-release.mjs");

    expect(packageJson).toContain(
      '"validate:migrations": "node scripts/validate-migration-release.mjs"',
    );
    expect(workflow).toContain("run: npm run validate:migrations");
    expect(validator).toContain("if (destructive.test(sql))");
    expect(validator).not.toContain("approved-destructive");
  });
});
