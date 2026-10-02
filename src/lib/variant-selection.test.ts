import { describe, expect, it } from "vitest";
import {
  isOptionValueAvailable,
  isOptionValueAvailableForSelection,
  resolveVariantSelection,
} from "./variant-selection";

const options = [
  { name: "Color", values: [{ id: "black" }, { id: "white" }] },
  { name: "Size", values: [{ id: "s" }, { id: "m" }] },
];
const variants = [
  { id: "black-s", available: 4, optionValueIds: ["black", "s"] },
  { id: "black-m", available: 3, optionValueIds: ["black", "m"] },
  { id: "white-s", available: 2, optionValueIds: ["white", "s"] },
  { id: "white-m", available: 0, optionValueIds: ["white", "m"] },
];

describe("resolveVariantSelection", () => {
  it("preserves compatible option choices", () => {
    expect(resolveVariantSelection(options, variants, { Color: "black", Size: "m" }, "Color", "white"))
      .toEqual({ variantId: "white-s", selection: { Color: "white", Size: "s" } });
  });

  it("falls back to an in-stock matching variant when the current combination is unavailable", () => {
    expect(resolveVariantSelection(options, variants, { Color: "white", Size: "m" }, "Size", "m"))
      .toEqual({ variantId: "black-m", selection: { Color: "black", Size: "m" } });
  });

  it("does not select a sold-out value when no available matching variant exists", () => {
    const result = resolveVariantSelection(options, variants, {}, "Size", "m");
    expect(result.variantId).toBe("black-m");
    expect(isOptionValueAvailable(variants, "white")).toBe(true);
    expect(isOptionValueAvailable([{ id: "x", available: 0, optionValueIds: ["sold"] }], "sold")).toBe(false);
  });

  it("only enables values compatible with the other selected dimensions", () => {
    expect(isOptionValueAvailableForSelection(options, variants, { Color: "white", Size: "" }, "Size", "m")).toBe(false);
    expect(isOptionValueAvailableForSelection(options, variants, { Color: "black", Size: "" }, "Size", "m")).toBe(true);
  });
});
