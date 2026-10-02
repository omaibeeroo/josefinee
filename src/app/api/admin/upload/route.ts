import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { assertSameOrigin } from "@/lib/csrf";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { storeImage } from "@/lib/storage";
import { toUserMessage, isAppError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Admin product-image upload. Accepts a single `file` field (multipart).
 * Validates signature, re-encodes to WebP, stores in object storage (or local
 * disk in development). Requires the products:write permission.
 */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  if (!can(session.user, "products:write")) {
    return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  try {
    await assertSameOrigin();
    await enforceRateLimit({ ...LIMITS.upload, key: `upload:${session.user.id}` });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "No file provided." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return Response.json({ ok: false, error: "Image is too large." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeImage({
      buffer,
      filename: file.name,
      declaredMime: file.type,
    });
    await recordAudit({
      actorUserId: session.user.id,
      action: "PRODUCT_IMAGE_UPLOADED",
      resource: "ProductImage",
      metadata: { filename: file.name, size: file.size },
    });

    return Response.json({ ok: true, ...stored });
  } catch (error) {
    console.error("[upload] failed", error);
    return Response.json(
      { ok: false, error: toUserMessage(error) },
      { status: isAppError(error) ? error.status : 500 },
    );
  }
}
