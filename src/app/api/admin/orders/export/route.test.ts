import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  enforceRateLimit: vi.fn(),
  exportOrdersCsv: vi.fn(),
}));

vi.mock("@/lib/auth/rbac", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/server/actions/admin-orders", () => ({ exportOrdersCsv: mocks.exportOrdersCsv }));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  LIMITS: { export: { limit: 30, windowMs: 60_000 } },
}));
vi.mock("@/lib/i18n/server", () => ({
  getAdminActionT: vi.fn(async () => ({
    wentWrong: "Something went wrong.",
    exportRateLimited: "Please wait before exporting again.",
    exportFiltersInvalid: "Export filters are invalid.",
  })),
}));

import { GET } from "./route";

function request(query = "") {
  return new Request(`https://store.example.test/api/admin/orders/export${query}`);
}

describe("admin order export route boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requirePermission.mockResolvedValue({ id: "staff-1" });
    mocks.enforceRateLimit.mockResolvedValue(undefined);
    mocks.exportOrdersCsv.mockResolvedValue("Order number,Total\n");
  });

  it("rejects missing export permission before rate limiting or reading export data", async () => {
    mocks.requirePermission.mockRejectedValueOnce(
      new AppError("FORBIDDEN", "Not allowed.", 403),
    );

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.exportOrdersCsv).not.toHaveBeenCalled();
  });

  it("rejects invalid filters and returns valid CSV only with no-store headers", async () => {
    const invalid = await GET(request("?status=UNKNOWN"));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("cache-control")).toBe("no-store");
    expect(mocks.exportOrdersCsv).not.toHaveBeenCalled();

    const response = await GET(request("?status=DELIVERED&search=HS-2026"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("orders-");
    expect(await response.text()).toContain("Order number,Total");
    expect(mocks.exportOrdersCsv).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DELIVERED", search: "HS-2026" }),
    );
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: "orders-export:staff-1" }),
    );
  });
});
