import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { assertSameOrigin } from "@/lib/csrf";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { storeImage } from "@/lib/storage";
import { toUserMessage, isAppError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Admin product-image upload. Accepts a single `file` field (multipart).
 * Validates signature, re-encodes to WebP, stores in object storage (or local
 * disk in development). Requires the products:write permission.
 */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ ok: false, error: "Please sign in." }, { status: 401, headers: NO_STORE });
  }
  if (!can(session.user, "products:write")) {
    return Response.json({ ok: false, error: "Forbidden." }, { status: 403, headers: NO_STORE });
  }

  try {
    await assertSameOrigin();
    await enforceRateLimit({ ...LIMITS.upload, key: `upload:${session.user.id}` });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "No file provided." }, { status: 400, headers: NO_STORE });
    }
    if (file.size > 8 * 1024 * 1024) {
      return Response.json({ ok: false, error: "Image is too large." }, { status: 413, headers: NO_STORE });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeImage({
      buffer,
      declaredMime: file.type,
    });
    await recordAudit({
      actorUserId: session.user.id,
      action: "PRODUCT_IMAGE_UPLOADED",
      resource: "ProductImage",
      metadata: { size: file.size, mimeType: stored.mimeType },
    });

    return Response.json({ ok: true, ...stored }, { headers: NO_STORE });
  } catch (error) {
    console.error("[upload] failed", error instanceof Error ? error.name : "unknown");
    return Response.json(
      { ok: false, error: toUserMessage(error) },
      { status: isAppError(error) ? error.status : 500, headers: NO_STORE },
    );
  }
}
