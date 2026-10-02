import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { getAdminSession } = await import("@/lib/auth/session");
  const session = await getAdminSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    select: { email: true, createdAt: true, unsubscribedAt: true },
  });

  const lines = ["email,subscribed_at,status"];
  for (const subscriber of subscribers) {
    lines.push(
      [`"${subscriber.email}"`, subscriber.createdAt.toISOString(), subscriber.unsubscribedAt ? "unsubscribed" : "active"].join(","),
    );
  }

  return new Response(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
