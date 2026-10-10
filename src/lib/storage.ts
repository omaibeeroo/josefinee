import "server-only";
import { AppError } from "@/lib/errors";
import { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BYTES } from "@/lib/constants";
import { isS3Configured } from "@/config/brand";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import type { Metadata, Sharp } from "sharp";

export type StoredImage = {
  url: string;
  storageKey: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  watermarked: boolean;
};

const MAX_DIMENSION = 2200;

/**
 * Optional brand watermark for copy protection. Point PRODUCT_WATERMARK_PATH
 * at a PNG with transparency (e.g. the white wordmark, ~600px wide, baked
 * at 60–80% opacity with its own padding). The mark is scaled to 18% of the
 * photo width and composited into the bottom-right corner.
 *
 * Unset = byte-identical pipeline (existing behavior, fully preserved).
 * Set-but-unreadable = upload fails closed so an admin never ships
 * unmarked photos believing they are protected.
 */
export async function applyProductWatermark(image: Buffer): Promise<{
  buffer: Buffer;
  watermarked: boolean;
}> {
  const markPath = (process.env.PRODUCT_WATERMARK_PATH ?? "").trim();
  if (!markPath) return { buffer: image, watermarked: false };

  const { default: sharp } = await import("sharp");
  const { readFile } = await import("node:fs/promises");
  let mark: Buffer;
  try {
    const resolved = path.isAbsolute(markPath) ? markPath : path.join(process.cwd(), markPath);
    mark = await readFile(resolved);
  } catch {
    throw new AppError(
      "STORAGE_MISCONFIGURED",
      "Product watermark is configured but unreadable.",
      500,
    );
  }
  const meta = await sharp(image).metadata();
  const targetWidth = Math.max(64, Math.floor((meta.width ?? 800) * 0.18));
  let overlay: Buffer;
  try {
    overlay = await sharp(mark).resize({ width: targetWidth }).png().toBuffer();
  } catch {
    throw new AppError("INVALID_WATERMARK", "Product watermark must be a valid image file.", 500);
  }
  const buffer = await sharp(image).composite([{ input: overlay, gravity: "southeast" }]).toBuffer();
  return { buffer, watermarked: true };
}

/** Uploads are always re-encoded to WebP, so the extension is constant. */
function storedExtension(): string {
  return "webp";
}

/**
 * Validates an uploaded image by decoding it with sharp (real signature check,
 * not just the declared mime type), re-encodes it to WebP, strips metadata and
 * stores it. Local disk is the development driver — production must use S3.
 */
export async function storeImage(file: {
  buffer: Buffer;
  declaredMime: string;
}): Promise<StoredImage> {
  if (file.buffer.byteLength > UPLOAD_MAX_BYTES) {
    throw new AppError("FILE_TOO_LARGE", "Image is too large (max 8 MB).", 413);
  }
  if (!UPLOAD_ALLOWED_MIME.includes(file.declaredMime as (typeof UPLOAD_ALLOWED_MIME)[number])) {
    throw new AppError("INVALID_FILE_TYPE", "Only JPG, PNG, WebP or AVIF images are allowed.");
  }

  // Lazy-loaded so non-upload serverless functions skip the native sharp bundle.
  const { default: sharp } = await import("sharp");
  let pipeline: Sharp;
  let metadata: Metadata;
  try {
    pipeline = sharp(file.buffer, { failOn: "error" });
    metadata = await pipeline.metadata();
  } catch {
    throw new AppError("INVALID_FILE", "The uploaded file is not a valid image.");
  }

  if (!metadata.format || !["jpeg", "png", "webp", "avif"].includes(metadata.format)) {
    throw new AppError("INVALID_FILE", "The uploaded file is not a valid image.");
  }

  // True-lossless catalog encode: bit-exact WebP (no quantization at all)
  // so what the admin uploads is what the customer sees — metal glints,
  // stone facets and fabric weave survive untouched. Only downscaled when
  // the source exceeds MAX_DIMENSION (never upscaled). Effort 6 costs CPU
  // once at upload time; rendering stays cheap because the file is served
  // byte-identical (see ProductImage `unoptimized`).
  const resized = await sharp(file.buffer)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .toBuffer();
  const marked = await applyProductWatermark(resized);
  const processed = await sharp(marked.buffer).webp({ lossless: true, effort: 6 }).toBuffer();

  const output = await sharp(processed).metadata();
  const width = output.width ?? metadata.width ?? MAX_DIMENSION;
  const height = output.height ?? metadata.height ?? MAX_DIMENSION;
  const sizeBytes = processed.byteLength;

  const now = new Date();
  const key = path.posix.join(
    `${now.getUTCFullYear()}`,
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    `${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 12)}.${storedExtension()}`,
  );

  if (isS3Configured()) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: process.env.STORAGE_REGION || "auto",
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY as string,
        secretAccessKey: process.env.STORAGE_SECRET_KEY as string,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.STORAGE_BUCKET,
        Key: key,
        Body: processed,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    const publicHost = (process.env.STORAGE_PUBLIC_HOST || "").split(",")[0]?.trim();
    if (!publicHost) {
      throw new AppError(
        "STORAGE_MISCONFIGURED",
        "Storage public host is not configured.",
        500,
      );
    }
    const base = publicHost.startsWith("http") ? publicHost : `https://${publicHost}`;
    return {
      url: `${base.replace(/\/$/, "")}/${key}`,
      storageKey: key,
      width,
      height,
      mimeType: "image/webp",
      sizeBytes,
      watermarked: marked.watermarked,
    };
  }

  // Local development driver.
  if (process.env.NODE_ENV === "production") {
    throw new AppError(
      "STORAGE_MISCONFIGURED",
      "Object storage must be configured in production (set STORAGE_DRIVER=s3).",
      500,
    );
  }

  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const absolute = path.join(uploadsRoot, key);
  if (!absolute.startsWith(uploadsRoot)) {
    throw new AppError("INVALID_PATH", "Invalid upload path.");
  }
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, processed);

  return {
    url: `/uploads/${key}`,
    storageKey: `local:${key}`,
    width,
    height,
    mimeType: "image/webp",
    sizeBytes,
    watermarked: marked.watermarked,
  };
}
