import { describe, expect, it } from "vitest";
import en from "./en";
import fr from "./fr";
import { parseLocale, DEFAULT_LOCALE } from "./locales";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

describe("i18n dictionaries", () => {
  it("en has exactly the same keys as fr", () => {
    expect(leafPaths(en).sort()).toEqual(leafPaths(fr).sort());
  });

  it("every leaf is a non-empty string", () => {
    const get = (obj: unknown, path: string): unknown =>
      path.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], obj);
    for (const path of leafPaths(fr)) {
      for (const dict of [fr, en]) {
        const value = get(dict, path);
        expect(typeof value, path).toBe("string");
        expect((value as string).length, path).toBeGreaterThan(0);
      }
    }
  });

  it("parseLocale falls back to the default", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("fr")).toBe("fr");
    expect(parseLocale("de")).toBe(DEFAULT_LOCALE);
    expect(parseLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});
