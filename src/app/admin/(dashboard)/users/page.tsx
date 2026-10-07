import { requirePermission } from "@/lib/auth/rbac";
import { listUsersAction } from "@/server/actions/admin-auth";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { StaffManager } from "./staff-manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requirePermission("users:manage");
  const [users, t] = await Promise.all([listUsersAction(), getDictionary()]);
  return (
    <div>
      <PageHeader title={t.adminPages.staffTitle} description={t.adminPages.staffDesc} />
      <StaffManager users={users} />
    </div>
  );
}