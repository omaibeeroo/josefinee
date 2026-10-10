import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuditActorType, Prisma } from "@prisma/client";

type AuditInput = {
  actorUserId?: string | null;
  actorType?: AuditActorType;
  action: string;
  resource: string;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Append-only audit trail. Audit rows are never updated or deleted by the app.
 * Failures here must never break the business operation that triggered them.
 *
 * Secret-shaped metadata keys are scrubbed before storage so a future caller
 * can never land a password, token, or secret in this immutable table.
 * Business identifiers (order numbers, resource IDs, emails) pass through.
 */
const SECRET_METADATA_KEY = /(password|passwd|pwd|token|secret|api[_-]?key|authorization)/i;

function scrubMetadata(value: Prisma.InputJsonValue | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => scrubMetadata(entry as Prisma.InputJsonValue) as Prisma.InputJsonValue);
  }
  if (typeof value === "object" && value !== null) {
    const clean: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      clean[key] = SECRET_METADATA_KEY.test(key)
        ? "[redacted]"
        : (scrubMetadata(entry as Prisma.InputJsonValue) as Prisma.InputJsonValue);
    }
    return clean;
  }
  return value;
}
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType ?? "USER",
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadata: scrubMetadata(input.metadata),
      },
    });
  } catch (error) {
    console.error("[audit] failed to record", input.action, error instanceof Error ? error.name : "unknown");
  }
}
