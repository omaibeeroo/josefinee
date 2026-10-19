import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/rbac";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { getAdminActionT } from "@/lib/i18n/server";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const t = await getAdminActionT();
  let actor;
  try {
    actor = await requirePermission("newsletter:export");
    await enforceRateLimit({ ...LIMITS.export, key: `newsletter-export:${actor.id}` });
  } catch (error) {
    const { isAppError } = await import("@/lib/errors");
    if (isAppError(error)) {
      return Response.json(
        { error: error.userMessage },
        { status: error.status, headers: NO_STORE },
      );
    }
    return Response.json({ error: t.forbidden }, { status: 403, headers: NO_STORE });
  }

  // Cap in the query so a huge list can never OOM the function.
  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    take: 5001,
    select: { email: true, createdAt: true, unsubscribedAt: true },
  });

  if (subscribers.length > 5000)
    return Response.json({ error: t.exportTooLarge }, { status: 413, headers: NO_STORE });
  const lines = ["email,subscribed_at,status"];
  const escape = (value: string) =>
    `"${(/^\s*[=+\-@]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
  for (const subscriber of subscribers) {
    lines.push(
      [
        escape(subscriber.email),
        subscriber.createdAt.toISOString(),
        subscriber.unsubscribedAt ? "unsubscribed" : "active",
      ].join(","),
    );
  }

  await recordAudit({
    actorUserId: actor.id,
    action: "NEWSLETTER_EXPORTED",
    resource: "NewsletterSubscriber",
    metadata: { count: subscribers.length },
  });
  return new Response(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-${new Date().toISOString().slice(0, 10)}.csv"`,
      ...NO_STORE,
    },
  });
}
