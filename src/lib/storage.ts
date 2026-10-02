import "server-only";
import { AppError } from "@/lib/errors";
import { UPLOAD_ALLOWED_MIME, UPLOAD_MAX_BYTES } from "@/lib/constants";
import { isS3Configured } from "@/config/brand";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import sharp, { type Metadata, type Sharp } from "sharp";

export type StoredImage = {
  url: string;
  storageKey: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
};

const MAX_DIMENSION = 2200;

function safeExtension(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/avif":
      return "avif";
    case "image/jpeg":
    default:
      return "webp";
  }
}

/**
 * Validates an uploaded image by decoding it with sharp (real signature check,
 * not just the declared mime type), re-encodes it to WebP, strips metadata and
 * stores it. Local disk is the development driver — production must use S3.
 */
export async function storeImage(file: {
  buffer: Buffer;
  filename: string;
  declaredMime: string;
}): Promise<StoredImage> {
  if (file.buffer.byteLength > UPLOAD_MAX_BYTES) {
    throw new AppError("FILE_TOO_LARGE", "Image is too large (max 8 MB).", 413);
  }
  if (!UPLOAD_ALLOWED_MIME.includes(file.declaredMime as (typeof UPLOAD_ALLOWED_MIME)[number])) {
    throw new AppError("INVALID_FILE_TYPE", "Only JPG, PNG, WebP or AVIF images are allowed.");
  }

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

  const processed = await sharp(file.buffer)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const output = await sharp(processed).metadata();
  const width = output.width ?? metadata.width ?? MAX_DIMENSION;
  const height = output.height ?? metadata.height ?? MAX_DIMENSION;
  const sizeBytes = processed.byteLength;

  const now = new Date();
  const key = path.posix.join(
    `${now.getUTCFullYear()}`,
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExtension("image/webp")}`,
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
  };
}

export async function deleteStoredImage(storageKey: string): Promise<void> {
  try {
    if (storageKey.startsWith("local:")) {
      const { unlink } = await import("node:fs/promises");
      const key = storageKey.slice("local:".length);
      const uploadsRoot = path.join(process.cwd(), "public", "uploads");
      const absolute = path.join(uploadsRoot, key);
      if (!absolute.startsWith(uploadsRoot)) return;
      await unlink(absolute).catch(() => undefined);
      return;
    }
    if (isS3Configured()) {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
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
        new DeleteObjectCommand({ Bucket: process.env.STORAGE_BUCKET, Key: storageKey }),
      );
    }
  } catch (error) {
    console.error("[storage] delete failed", storageKey, error);
  }
}
