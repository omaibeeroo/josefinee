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
 */
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
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record", input.action, error);
  }
}
