import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { SecurityManager } from "./security-manager";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return (
    <div>
      <PageHeader title="My security" description="Protect your admin account with a strong password and 2FA." />
      <SecurityManager twoFactorEnabled={session.user.twoFactorEnabled} />
    </div>
  );
}
