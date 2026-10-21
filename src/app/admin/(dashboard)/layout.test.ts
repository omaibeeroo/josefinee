import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("shared admin dashboard layout authorization", () => {
  it("places the MFA-pending redirect before dashboard reads and shell alerts", () => {
    const guard = layoutSource.indexOf(
      "const dashboardRedirect = getAdminDashboardRedirect(session);",
    );

    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(
      layoutSource.indexOf("const codes = new Set(permissionCodes(user));"),
    );
    expect(guard).toBeLessThan(layoutSource.indexOf("const t = await getDictionary();"));
    expect(guard).toBeLessThan(layoutSource.indexOf("pendingOrders = await prisma.order.count"));
    expect(guard).toBeLessThan(layoutSource.indexOf("return (\n    <AdminShell"));
  });
});
