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
      <PageHeader title="Ma sécurité" description="Protégez votre compte admin avec un mot de passe fort et la 2FA." />
      <SecurityManager twoFactorEnabled={session.user.twoFactorEnabled} />
    </div>
  );
}
