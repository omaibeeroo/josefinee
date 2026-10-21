import { describe, expect, it } from "vitest";
import { publicSearchTerm } from "@/server/navigation";

describe("public search privacy", () => {
  it("keeps ordinary multilingual product terms", () => {
    expect(publicSearchTerm("  Bagues   dorées ")).toBe("bagues dorées");
    expect(publicSearchTerm("حقيبة جلدية")).toBe("حقيبة جلدية");
  });

  it("rejects emails, phones, order references, and noisy identifiers", () => {
    expect(publicSearchTerm("buyer@example.com")).toBeNull();
    expect(publicSearchTerm("0550123456")).toBeNull();
    expect(publicSearchTerm("HAN-2026-000123")).toBeNull();
    expect(publicSearchTerm("<script>alert(1)</script>")).toBeNull();
  });
});
