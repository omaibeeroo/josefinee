import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "./middleware";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Preview data-isolation fence", () => {
  it("blocks every request until isolated Preview data stores are confirmed", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("HANADI_PREVIEW_DATA_ISOLATION_CONFIRMED", "false");

    const response = await middleware(
      new NextRequest("https://preview.hanadistore.vercel.app/api/internal/retention", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("300");
    expect(response.headers.get("x-hanadi-preview-isolation")).toBe("required");
    await expect(response.text()).resolves.toContain("data isolation is confirmed");
  });

  it("allows Preview middleware to continue after isolation is explicitly confirmed", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("HANADI_PREVIEW_DATA_ISOLATION_CONFIRMED", "true");

    const response = await middleware(
      new NextRequest("https://preview.hanadistore.vercel.app/"),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-hanadi-preview-isolation")).toBeNull();
  });
});
