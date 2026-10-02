import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-navigation";

describe("safeInternalPath", () => {
  it("preserves an internal path, query and fragment", () => {
    expect(safeInternalPath("/checkout?step=delivery#address")).toBe("/checkout?step=delivery#address");
  });

  it.each([
    "https://attacker.example",
    "//attacker.example/path",
    "/\\attacker.example",
    "javascript:alert(1)",
    "checkout",
    "/account\n//attacker.example",
  ])("falls back for unsafe destination %s", (value) => {
    expect(safeInternalPath(value)).toBe("/account");
  });

  it("supports an explicitly supplied internal fallback", () => {
    expect(safeInternalPath("//attacker.example", "/")).toBe("/");
  });
});
