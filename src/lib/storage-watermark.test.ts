import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyProductWatermark } from "@/lib/storage";

async function makePng(
  width: number,
  height: number,
  background: { r: number; g: number; b: number; alpha?: number },
): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp({
    create: { width, height, channels: 4, background },
  })
    .png()
    .toBuffer();
}

afterEach(() => {
  delete process.env.PRODUCT_WATERMARK_PATH;
});

describe("applyProductWatermark", () => {
  it("leaves the image byte-identical when no watermark is configured", async () => {
    const base = await makePng(400, 300, { r: 200, g: 180, b: 160 });
    const result = await applyProductWatermark(base);
    expect(result.watermarked).toBe(false);
    expect(Buffer.compare(result.buffer, base)).toBe(0);
  });

  it("composites the mark and preserves dimensions when configured", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hanadi-wm-"));
    const markPath = join(dir, "mark.png");
    writeFileSync(markPath, await makePng(200, 80, { r: 255, g: 255, b: 255, alpha: 0.7 }));
    process.env.PRODUCT_WATERMARK_PATH = markPath;

    const base = await makePng(400, 300, { r: 200, g: 180, b: 160 });
    const result = await applyProductWatermark(base);
    expect(result.watermarked).toBe(true);
    expect(Buffer.compare(result.buffer, base)).not.toBe(0);

    const { default: sharp } = await import("sharp");
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  it("fails closed when the configured mark is unreadable", async () => {
    process.env.PRODUCT_WATERMARK_PATH = join(tmpdir(), "hanadi-wm-missing", "mark.png");
    const base = await makePng(100, 100, { r: 1, g: 2, b: 3 });
    await expect(applyProductWatermark(base)).rejects.toMatchObject({
      code: "STORAGE_MISCONFIGURED",
    });
  });
});
