import { describe, expect, it } from "vitest";
import { productionEnvironmentIssues } from "./production-env";

const validProductionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://app-user:test-only-password@db.example.test:5432/nur_store?schema=public",
  AUTH_SECRET: "unit-test-secret-value-that-is-not-used-outside-tests",
  ORDER_OUTBOX_SECRET: "separate-unit-test-outbox-secret-value",
  RETENTION_JOB_SECRET: "separate-unit-test-retention-secret-value",
  APP_URL: "https://store.example.test",
  TRUSTED_CLIENT_IP_HEADER: "x-real-ip",
  STORAGE_DRIVER: "s3",
  STORAGE_BUCKET: "nur-test-bucket",
  STORAGE_ACCESS_KEY: "test-access-key",
  STORAGE_SECRET_KEY: "test-secret-key",
  STORAGE_PUBLIC_HOST: "https://cdn.example.test",
};

describe("productionEnvironmentIssues", () => {
  it("does not impose production requirements on development", () => {
    expect(productionEnvironmentIssues({ NODE_ENV: "development" })).toEqual([]);
  });

  it("accepts a fully configured canonical production environment", () => {
    expect(productionEnvironmentIssues(validProductionEnv)).toEqual([]);
  });

  it("reports missing production settings by name only", () => {
    const issues = productionEnvironmentIssues({ NODE_ENV: "production" });
    expect(issues).toContain("DATABASE_URL must be a valid PostgreSQL connection URL with a host and database name");
    expect(issues).toContain("AUTH_SECRET must be a unique secret of at least 32 characters");
    expect(issues).toContain("ORDER_OUTBOX_SECRET must be a unique secret of at least 32 characters");
    expect(issues).toContain("RETENTION_JOB_SECRET must be a unique secret of at least 32 characters");
    expect(issues).toContain("APP_URL must be set to the canonical HTTPS storefront origin");
    expect(issues).toContain("TRUSTED_CLIENT_IP_HEADER must name a header overwritten by the trusted reverse proxy");
    expect(issues).toContain("STORAGE_DRIVER must be s3 in production");
  });

  it("rejects malformed database URLs and insecure or credential-bearing storage hosts", () => {
    const databaseIssues = productionEnvironmentIssues({
      ...validProductionEnv,
      DATABASE_URL: "postgres://",
    });
    expect(databaseIssues).toContain("DATABASE_URL must be a valid PostgreSQL connection URL with a host and database name");

    const storageIssues = productionEnvironmentIssues({
      ...validProductionEnv,
      STORAGE_PUBLIC_HOST: "http://cdn.example.test,https://user:password@other.example.test",
    });
    expect(storageIssues).toContain("STORAGE_PUBLIC_HOST must contain valid HTTPS hosts without credentials, query strings, or fragments");
  });

  it("rejects local HTTP origins and unsanitized proxy headers", () => {
    const issues = productionEnvironmentIssues({
      ...validProductionEnv,
      APP_URL: "http://localhost:3000",
      TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for, x-real-ip",
    });
    expect(issues).toContain("APP_URL must be a canonical HTTPS origin, not localhost");
    expect(issues).toContain("TRUSTED_CLIENT_IP_HEADER must name a header overwritten by the trusted reverse proxy");
  });
});
