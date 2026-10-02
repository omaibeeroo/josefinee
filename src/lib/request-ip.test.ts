import { describe, expect, it } from "vitest";
import { extractClientIp } from "./request-ip";

const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe("extractClientIp", () => {
  it("uses one validated edge address in production", () => {
    expect(extractClientIp(headers({ "x-real-ip": "203.0.113.14" }), { production: true })).toBe("203.0.113.14");
    expect(extractClientIp(headers({ "x-real-ip": "not-an-ip" }), { production: true })).toBeNull();
  });

  it("does not trust X-Forwarded-For in production", () => {
    expect(extractClientIp(headers({ "x-forwarded-for": "203.0.113.14" }), { production: true })).toBeNull();
    expect(extractClientIp(headers({ "x-real-ip": "203.0.113.14, 198.51.100.2" }), { production: true })).toBeNull();
  });

  it("allows X-Forwarded-For only as a local development fallback", () => {
    expect(extractClientIp(headers({ "x-forwarded-for": "203.0.113.14, 198.51.100.2" }), { production: false })).toBe("203.0.113.14");
  });

  it("rejects invalid configured header names", () => {
    expect(extractClientIp(headers({ "x-real-ip": "203.0.113.14" }), { production: true, trustedHeader: "x-real-ip, x-forwarded-for" })).toBeNull();
  });
});
