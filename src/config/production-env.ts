import { isTrustedClientIpHeaderName } from "@/lib/trusted-ip-header";

type Environment = Record<string, string | undefined>;

function isValidDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
      Boolean(url.hostname) &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
}

function hasValidStoragePublicHosts(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return false;
  return entries.every((entry) => {
    try {
      const url = new URL(entry.includes("://") ? entry : `https://${entry}`);
      return (
        url.protocol === "https:" &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  });
}

export function productionEnvironmentIssues(env: Environment = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const issues: string[] = [];

  if (!isValidDatabaseUrl(env.DATABASE_URL)) {
    issues.push(
      "DATABASE_URL must be a valid PostgreSQL connection URL with a host and database name",
    );
  }
  const secretNames = ["AUTH_SECRET", "ORDER_OUTBOX_SECRET", "RETENTION_JOB_SECRET"] as const;
  const seenSecrets = new Set<string>();
  for (const name of secretNames) {
    const value = env[name];
    if (
      !value ||
      value.length < 32 ||
      /replace-with|changeme|example/i.test(value) ||
      isLowEntropySecret(value)
    ) {
      // Deliberately report only the variable name and never its value.
      issues.push(`${name} must be a unique secret of at least 32 characters`);
    }
    if (value && seenSecrets.has(value)) {
      issues.push(`${name} must be different from the other production secrets`);
    }
    if (value) seenSecrets.add(value);
  }
  if (!env.APP_URL) {
    issues.push("APP_URL must be set to the canonical HTTPS storefront origin");
  } else {
    try {
      const url = new URL(env.APP_URL);
      if (
        url.protocol !== "https:" ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
      ) {
        issues.push("APP_URL must be a canonical HTTPS origin, not localhost");
      }
    } catch {
      issues.push("APP_URL must be a valid canonical HTTPS origin");
    }
  }

  const trustedHeader = env.TRUSTED_CLIENT_IP_HEADER;
  if (!isTrustedClientIpHeaderName(trustedHeader)) {
    issues.push(
      "TRUSTED_CLIENT_IP_HEADER must name a dedicated header overwritten by the trusted reverse proxy (not a forwarding-chain header)",
    );
  }
  if (env.STORAGE_DRIVER !== "s3") {
    issues.push("STORAGE_DRIVER must be s3 in production");
  }
  for (const name of [
    "STORAGE_BUCKET",
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET_KEY",
    "STORAGE_PUBLIC_HOST",
  ]) {
    if (!env[name]?.trim()) issues.push(`${name} must be configured for production object storage`);
  }
  if (env.STORAGE_PUBLIC_HOST?.trim() && !hasValidStoragePublicHosts(env.STORAGE_PUBLIC_HOST)) {
    issues.push(
      "STORAGE_PUBLIC_HOST must contain valid HTTPS hosts without credentials, query strings, or fragments",
    );
  }

  // The storefront maintenance gate may keep production/admin available while
  // provider credentials are still an owner release gate. It never permits a
  // console or unknown provider, and opening the public site restores strict checks.
  const publicMaintenance = env.PUBLIC_SITE_MAINTENANCE === "true";
  const emailProvider = env.EMAIL_PROVIDER;
  if (!emailProvider) {
    if (!publicMaintenance) {
      issues.push("EMAIL_PROVIDER must be explicitly configured as resend in production");
    }
  } else if (emailProvider === "console") {
    issues.push("EMAIL_PROVIDER=console is not permitted in production; configure resend");
  } else if (emailProvider !== "resend") {
    issues.push("EMAIL_PROVIDER must be resend or console");
  } else if (emailProvider === "resend") {
    if (!publicMaintenance && !env.EMAIL_API_KEY?.trim())
      issues.push("EMAIL_API_KEY must be configured when EMAIL_PROVIDER is resend");
    if (!publicMaintenance && !env.EMAIL_FROM?.trim())
      issues.push("EMAIL_FROM must be configured when EMAIL_PROVIDER is resend");
  }

  const smsProvider = env.SMS_PROVIDER;
  if (!smsProvider) {
    if (!publicMaintenance) {
      issues.push("SMS_PROVIDER must be explicitly configured as twilio in production");
    }
  } else if (smsProvider === "console") {
    issues.push("SMS_PROVIDER=console is not permitted in production; configure twilio");
  } else if (smsProvider !== "twilio") {
    issues.push("SMS_PROVIDER must be twilio or console");
  } else if (smsProvider === "twilio") {
    for (const name of ["SMS_ACCOUNT_SID", "SMS_API_KEY", "SMS_FROM"]) {
      if (!publicMaintenance && !env[name]?.trim()) {
        issues.push(`${name} must be configured when SMS_PROVIDER is twilio`);
      }
    }
  }

  const whatsappProvider = env.WHATSAPP_PROVIDER;
  if (!whatsappProvider) {
    if (!publicMaintenance) {
      issues.push("WHATSAPP_PROVIDER must be explicitly configured as meta in production");
    }
  } else if (whatsappProvider === "console") {
    issues.push("WHATSAPP_PROVIDER=console is not permitted in production; configure meta");
  } else if (whatsappProvider !== "meta") {
    issues.push("WHATSAPP_PROVIDER must be meta or console");
  } else if (whatsappProvider === "meta") {
    for (const name of ["WHATSAPP_API_KEY", "WHATSAPP_PHONE_NUMBER_ID"]) {
      if (!publicMaintenance && !env[name]?.trim())
        issues.push(`${name} must be configured when WHATSAPP_PROVIDER is meta`);
    }
  }

  return issues;
}

/** A long secret with almost no distinct characters (e.g. 32× "a") has no
 * real entropy despite passing length checks. This is intentionally a
 * conservative release gate, not a substitute for rotating secrets. */
export function isLowEntropySecret(value: string | undefined): boolean {
  if (!value || value.length < 32) return false;
  if (new Set(value).size < 10) return true;

  // Also reject deterministic cycles such as "0123456789" repeated four
  // times, which have enough distinct characters to evade the first check.
  for (let period = 1; period <= Math.floor(value.length / 2); period += 1) {
    if (value.length % period !== 0) continue;
    let repeats = true;
    for (let index = period; index < value.length; index += 1) {
      if (value[index] !== value[index % period]) {
        repeats = false;
        break;
      }
    }
    if (repeats) return true;
  }
  return false;
}

export function assertProductionEnvironment(env: Environment = process.env): void {
  const issues = productionEnvironmentIssues(env);
  if (issues.length > 0) {
    throw new Error(`Production environment is not ready:\n- ${issues.join("\n- ")}`);
  }
}
