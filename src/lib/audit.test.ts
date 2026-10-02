import { beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create },
  },
}));

import { recordAudit } from "@/lib/audit";

describe("recordAudit", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ id: "audit-1" });
  });

  it("persists actor, resource, request context, and metadata", async () => {
    await recordAudit({
      actorUserId: "user-1",
      action: "ORDERS_EXPORTED",
      resource: "Order",
      resourceId: "export",
      ip: "192.0.2.10",
      userAgent: "test-agent",
      metadata: { count: 3 },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user-1",
        actorType: "USER",
        action: "ORDERS_EXPORTED",
        resource: "Order",
        resourceId: "export",
        ip: "192.0.2.10",
        userAgent: "test-agent",
        metadata: { count: 3 },
      },
    });
  });

  it("keeps unauthenticated security events unattributed to a user", async () => {
    await recordAudit({
      actorType: "SYSTEM",
      actorUserId: null,
      action: "ADMIN_MFA_FAILED",
      resource: "User",
      resourceId: "target-user",
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorType: "SYSTEM", actorUserId: null }),
    });
  });

  it("does not make a business action fail when audit persistence is unavailable", async () => {
    const error = new Error("database unavailable");
    create.mockRejectedValueOnce(error);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(recordAudit({ action: "TEST", resource: "Test" })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("[audit] failed to record", "TEST", error);

    errorSpy.mockRestore();
  });
});
