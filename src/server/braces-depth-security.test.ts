import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const braces = require("braces") as (pattern: string) => unknown;

describe("braces dependency nesting guard", () => {
  it("accepts the documented safe depth and rejects deeper brace patterns", () => {
    const safePattern = "{".repeat(100) + "x" + "}".repeat(100);
    const unsafePattern = "{".repeat(101) + "x" + "}".repeat(101);

    expect(() => braces(safePattern)).not.toThrow();
    expect(() => braces(unsafePattern)).toThrow(/exceeds max depth \(100\)/);
  });

  it("rejects deeply nested parenthesis patterns", () => {
    const unsafePattern = "(".repeat(101) + ")".repeat(101);

    expect(() => braces(unsafePattern)).toThrow(/exceeds max depth \(100\)/);
  });
});
