import { requirePermission } from "@/lib/auth/rbac";
import { listUsersAction } from "@/server/actions/admin-auth";
import { PageHeader } from "@/components/admin/ui";
import { StaffManager } from "./staff-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requirePermission("users:manage");
  const users = await listUsersAction();
  return (
    <div>
      <PageHeader title="Équipe" description="Accès par rôles. Les nouveaux comptes doivent changer leur mot de passe à la première connexion." />
      <StaffManager users={users} />
    </div>
  );
}
