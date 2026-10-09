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
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
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
    issues.push("DATABASE_URL must be a valid PostgreSQL connection URL with a host and database name");
  }
  if (
    !env.AUTH_SECRET ||
    env.AUTH_SECRET.length < 32 ||
    /replace-with|changeme|example/i.test(env.AUTH_SECRET)
  ) {
    issues.push("AUTH_SECRET must be a unique secret of at least 32 characters");
  }
  if (
    !env.ORDER_OUTBOX_SECRET ||
    env.ORDER_OUTBOX_SECRET.length < 32 ||
    /replace-with|changeme|example/i.test(env.ORDER_OUTBOX_SECRET)
  ) {
    issues.push("ORDER_OUTBOX_SECRET must be a unique secret of at least 32 characters");
  }
  if (
    !env.RETENTION_JOB_SECRET ||
    env.RETENTION_JOB_SECRET.length < 32 ||
    /replace-with|changeme|example/i.test(env.RETENTION_JOB_SECRET)
  ) {
    issues.push("RETENTION_JOB_SECRET must be a unique secret of at least 32 characters");
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
  if (!trustedHeader || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(trustedHeader)) {
    issues.push("TRUSTED_CLIENT_IP_HEADER must name a header overwritten by the trusted reverse proxy");
  }
  if (env.STORAGE_DRIVER !== "s3") {
    issues.push("STORAGE_DRIVER must be s3 in production");
  }
  for (const name of ["STORAGE_BUCKET", "STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY", "STORAGE_PUBLIC_HOST"]) {
    if (!env[name]?.trim()) issues.push(`${name} must be configured for production object storage`);
  }
  if (env.STORAGE_PUBLIC_HOST?.trim() && !hasValidStoragePublicHosts(env.STORAGE_PUBLIC_HOST)) {
    issues.push("STORAGE_PUBLIC_HOST must contain valid HTTPS hosts without credentials, query strings, or fragments");
  }

  const emailProvider = env.EMAIL_PROVIDER ?? "console";
  if (!["console", "resend"].includes(emailProvider)) {
    issues.push("EMAIL_PROVIDER must be resend or console");
  } else if (emailProvider === "resend") {
    if (!env.EMAIL_API_KEY?.trim()) issues.push("EMAIL_API_KEY must be configured when EMAIL_PROVIDER is resend");
    if (!env.EMAIL_FROM?.trim()) issues.push("EMAIL_FROM must be configured when EMAIL_PROVIDER is resend");
  }

  const smsProvider = env.SMS_PROVIDER ?? "console";
  if (!["console", "twilio"].includes(smsProvider)) {
    issues.push("SMS_PROVIDER must be twilio or console");
  } else if (smsProvider === "twilio") {
    for (const name of ["SMS_ACCOUNT_SID", "SMS_API_KEY", "SMS_FROM"]) {
      if (!env[name]?.trim()) issues.push(`${name} must be configured when SMS_PROVIDER is twilio`);
    }
  }

  const whatsappProvider = env.WHATSAPP_PROVIDER ?? "console";
  if (!["console", "meta"].includes(whatsappProvider)) {
    issues.push("WHATSAPP_PROVIDER must be meta or console");
  } else if (whatsappProvider === "meta") {
    for (const name of ["WHATSAPP_API_KEY", "WHATSAPP_PHONE_NUMBER_ID"]) {
      if (!env[name]?.trim()) issues.push(`${name} must be configured when WHATSAPP_PROVIDER is meta`);
    }
  }

  return issues;
}

/** A long secret with almost no distinct characters (e.g. 32× "a") has no
 *  real entropy despite passing length checks. */
export function isLowEntropySecret(value: string | undefined): boolean {
  if (!value || value.length < 32) return false;
  return new Set(value).size < 10;
}

export function assertProductionEnvironment(env: Environment = process.env): void {
  const issues = productionEnvironmentIssues(env);
  if (issues.length > 0) {
    throw new Error(`Production environment is not ready:\n- ${issues.join("\n- ")}`);
  }
  // Warning only (never a boot blocker): rotating a live secret on short
  // notice would be worse than flagging it for the next maintenance window.
  for (const name of ["AUTH_SECRET", "ORDER_OUTBOX_SECRET", "RETENTION_JOB_SECRET"] as const) {
    if (isLowEntropySecret(env[name])) {
      console.error(
        `[security] ${name} looks low-entropy; rotate it to 32+ random bytes when convenient.`,
      );
    }
  }
}
