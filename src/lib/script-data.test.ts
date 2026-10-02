import { describe, expect, it } from "vitest";
import { serializeForInlineJsonScript, validatedPixelId } from "./script-data";

describe("serializeForInlineJsonScript", () => {
  it("escapes HTML script-breaking characters while preserving JSON data", () => {
    const input = { name: "</script><script>alert(1)</script>", separator: "\u2028" };
    const serialized = serializeForInlineJsonScript(input);
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">\u2028");
    expect(JSON.parse(serialized)).toEqual(input);
  });

  it("rejects values JSON cannot serialize", () => {
    expect(() => serializeForInlineJsonScript(undefined)).toThrow(TypeError);
  });
});

describe("validatedPixelId", () => {
  it("accepts supported identifiers and rejects script-like input", () => {
    expect(validatedPixelId("ga", "G-ABC123")).toBe("G-ABC123");
    expect(validatedPixelId("ga", "UA-123456-1")).toBe("UA-123456-1");
    expect(validatedPixelId("meta", "123456789012345")).toBe("123456789012345");
    expect(validatedPixelId("tiktok", "C123abc_XYZ")).toBe("C123abc_XYZ");
    expect(validatedPixelId("meta", "');alert(1);//")).toBe("");
    expect(validatedPixelId("tiktok", "</script>")).toBe("");
  });
});
