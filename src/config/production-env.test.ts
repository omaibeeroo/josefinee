import { describe, expect, it } from "vitest";
import {
  assertProductionEnvironment,
  isLowEntropySecret,
  productionEnvironmentIssues,
} from "./production-env";

const validProductionEnv = {
  NODE_ENV: "production",
  DATABASE_URL:
    "postgresql://app-user:test-only-password@db.example.test:5432/hanadi_store?schema=public",
  AUTH_SECRET: "unit-test-secret-value-that-is-not-used-outside-tests",
  ORDER_OUTBOX_SECRET: "separate-unit-test-outbox-secret-value",
  RETENTION_JOB_SECRET: "separate-unit-test-retention-secret-value",
  APP_URL: "https://store.example.test",
  TRUSTED_CLIENT_IP_HEADER: "x-real-ip",
  STORAGE_DRIVER: "s3",
  STORAGE_BUCKET: "hanadi-test-bucket",
  STORAGE_ACCESS_KEY: "test-access-key",
  STORAGE_SECRET_KEY: "test-secret-key",
  STORAGE_PUBLIC_HOST: "https://cdn.example.test",
  EMAIL_PROVIDER: "resend",
  EMAIL_API_KEY: "test-email-api-key",
  EMAIL_FROM: "Hanadi Store <orders@example.test>",
  SMS_PROVIDER: "twilio",
  SMS_API_KEY: "test-sms-api-key",
  SMS_ACCOUNT_SID: "test-sms-account",
  SMS_FROM: "+15555550100",
  WHATSAPP_PROVIDER: "meta",
  WHATSAPP_API_KEY: "test-whatsapp-api-key",
  WHATSAPP_PHONE_NUMBER_ID: "test-whatsapp-phone",
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
    expect(issues).toContain(
      "DATABASE_URL must be a valid PostgreSQL connection URL with a host and database name",
    );
    expect(issues).toContain("AUTH_SECRET must be a unique secret of at least 32 characters");
    expect(issues).toContain(
      "ORDER_OUTBOX_SECRET must be a unique secret of at least 32 characters",
    );
    expect(issues).toContain(
      "RETENTION_JOB_SECRET must be a unique secret of at least 32 characters",
    );
    expect(issues).toContain("APP_URL must be set to the canonical HTTPS storefront origin");
    expect(issues).toContain(
      "TRUSTED_CLIENT_IP_HEADER must name a dedicated header overwritten by the trusted reverse proxy (not a forwarding-chain header)",
    );
    expect(issues).toContain("STORAGE_DRIVER must be s3 in production");
  });

  it("rejects malformed database URLs and insecure or credential-bearing storage hosts", () => {
    const databaseIssues = productionEnvironmentIssues({
      ...validProductionEnv,
      DATABASE_URL: "postgres://",
    });
    expect(databaseIssues).toContain(
      "DATABASE_URL must be a valid PostgreSQL connection URL with a host and database name",
    );

    const storageIssues = productionEnvironmentIssues({
      ...validProductionEnv,
      STORAGE_PUBLIC_HOST: "http://cdn.example.test,https://user:password@other.example.test",
    });
    expect(storageIssues).toContain(
      "STORAGE_PUBLIC_HOST must contain valid HTTPS hosts without credentials, query strings, or fragments",
    );
  });

  it("rejects local HTTP origins and unsanitized proxy headers", () => {
    const issues = productionEnvironmentIssues({
      ...validProductionEnv,
      APP_URL: "http://localhost:3000",
      TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for, x-real-ip",
    });
    expect(issues).toContain("APP_URL must be a canonical HTTPS origin, not localhost");
    expect(issues).toContain(
      "TRUSTED_CLIENT_IP_HEADER must name a dedicated header overwritten by the trusted reverse proxy (not a forwarding-chain header)",
    );
  });

  it("requires credentials when a real notification provider is enabled", () => {
    const issues = productionEnvironmentIssues({
      ...validProductionEnv,
      EMAIL_PROVIDER: "resend",
      EMAIL_API_KEY: undefined,
      EMAIL_FROM: undefined,
      SMS_PROVIDER: "twilio",
      SMS_ACCOUNT_SID: undefined,
      SMS_API_KEY: undefined,
      SMS_FROM: undefined,
      WHATSAPP_PROVIDER: "meta",
      WHATSAPP_API_KEY: undefined,
      WHATSAPP_PHONE_NUMBER_ID: undefined,
    });
    expect(issues).toContain("EMAIL_API_KEY must be configured when EMAIL_PROVIDER is resend");
    expect(issues).toContain("EMAIL_FROM must be configured when EMAIL_PROVIDER is resend");
    expect(issues).toContain("SMS_ACCOUNT_SID must be configured when SMS_PROVIDER is twilio");
    expect(issues).toContain("WHATSAPP_API_KEY must be configured when WHATSAPP_PROVIDER is meta");
  });

  it("flags low-entropy secrets without failing length checks", () => {
    expect(isLowEntropySecret("a".repeat(32))).toBe(true);
    expect(isLowEntropySecret("0123456789".repeat(4))).toBe(true);
    expect(isLowEntropySecret("unit-test-secret-value-that-is-not-used-outside-tests")).toBe(false);
    expect(isLowEntropySecret(undefined)).toBe(false);
    expect(isLowEntropySecret("short")).toBe(false);
  });

  it("rejects missing and console notification providers in production", () => {
    const missingIssues = productionEnvironmentIssues({
      ...validProductionEnv,
      EMAIL_PROVIDER: undefined,
      SMS_PROVIDER: undefined,
      WHATSAPP_PROVIDER: undefined,
    });
    expect(missingIssues).toContain(
      "EMAIL_PROVIDER must be explicitly configured as resend in production",
    );
    expect(missingIssues).toContain(
      "SMS_PROVIDER must be explicitly configured as twilio in production",
    );
    expect(missingIssues).toContain(
      "WHATSAPP_PROVIDER must be explicitly configured as meta in production",
    );

    const consoleIssues = productionEnvironmentIssues({
      ...validProductionEnv,
      EMAIL_PROVIDER: "console",
      SMS_PROVIDER: "console",
      WHATSAPP_PROVIDER: "console",
    });
    expect(consoleIssues).toContain(
      "EMAIL_PROVIDER=console is not permitted in production; configure resend",
    );
    expect(consoleIssues).toContain(
      "SMS_PROVIDER=console is not permitted in production; configure twilio",
    );
    expect(consoleIssues).toContain(
      "WHATSAPP_PROVIDER=console is not permitted in production; configure meta",
    );
  });

  it("allows missing notification settings only while the public site is explicitly in maintenance", () => {
    const maintenanceEnv = {
      ...validProductionEnv,
      PUBLIC_SITE_MAINTENANCE: "true",
      EMAIL_PROVIDER: undefined,
      EMAIL_API_KEY: undefined,
      EMAIL_FROM: undefined,
      SMS_PROVIDER: undefined,
      SMS_ACCOUNT_SID: undefined,
      SMS_API_KEY: undefined,
      SMS_FROM: undefined,
      WHATSAPP_PROVIDER: undefined,
      WHATSAPP_API_KEY: undefined,
      WHATSAPP_PHONE_NUMBER_ID: undefined,
    };
    expect(productionEnvironmentIssues(maintenanceEnv).filter((issue) => /EMAIL|SMS|WHATSAPP/.test(issue))).toEqual([]);

    const consoleIssues = productionEnvironmentIssues({
      ...maintenanceEnv,
      EMAIL_PROVIDER: "console",
    });
    expect(consoleIssues).toContain(
      "EMAIL_PROVIDER=console is not permitted in production; configure resend",
    );
  });

  it("treats low-entropy secrets as production release blockers", () => {
    const issues = productionEnvironmentIssues({
      ...validProductionEnv,
      AUTH_SECRET: "a".repeat(32),
    });
    expect(issues).toContain("AUTH_SECRET must be a unique secret of at least 32 characters");
    expect(() =>
      assertProductionEnvironment({ ...validProductionEnv, AUTH_SECRET: "a".repeat(32) }),
    ).toThrow(/AUTH_SECRET must be a unique secret/);
  });

  it("rejects reused production secrets without exposing their values", () => {
    const reusedSecret = "same-production-secret-value-with-enough-length";
    const env = {
      ...validProductionEnv,
      AUTH_SECRET: reusedSecret,
      ORDER_OUTBOX_SECRET: reusedSecret,
    };
    const issues = productionEnvironmentIssues(env);
    expect(issues).toContain(
      "ORDER_OUTBOX_SECRET must be different from the other production secrets",
    );
    expect(() => assertProductionEnvironment(env)).toThrow(/ORDER_OUTBOX_SECRET must be different/);
    let thrown: unknown;
    try {
      assertProductionEnvironment(env);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(reusedSecret);
  });

  it("rejects unknown notification providers", () => {
    const issues = productionEnvironmentIssues({
      ...validProductionEnv,
      EMAIL_PROVIDER: "unknown",
      SMS_PROVIDER: "unknown",
      WHATSAPP_PROVIDER: "unknown",
    });
    expect(issues).toContain("EMAIL_PROVIDER must be resend or console");
    expect(issues).toContain("SMS_PROVIDER must be twilio or console");
    expect(issues).toContain("WHATSAPP_PROVIDER must be meta or console");
  });
});
