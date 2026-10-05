import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/rbac";
import { enforceRateLimit, LIMITS } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  let actor;
  try {
    actor = await requirePermission("newsletter:export");
    await enforceRateLimit({ ...LIMITS.adminLogin, key: `newsletter-export:${actor.id}` });
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  }

  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    select: { email: true, createdAt: true, unsubscribedAt: true },
  });

  if (subscribers.length >= 5000)
    return Response.json({ error: "Export too large." }, { status: 413, headers: NO_STORE });
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
