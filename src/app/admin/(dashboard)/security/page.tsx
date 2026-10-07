import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/server";
import { PageHeader } from "@/components/admin/ui";
import { SecurityManager } from "./security-manager";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const [session, t] = await Promise.all([getAdminSession(), getDictionary()]);
  if (!session) redirect("/admin/login");
  return (
    <div>
      <PageHeader title={t.adminPages.securityTitle} description={t.adminPages.securityDesc} />
      <SecurityManager twoFactorEnabled={session.user.twoFactorEnabled} />
    </div>
  );
}
