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
      <PageHeader title="Staff" description="Role-based access. New accounts must change their password on first login." />
      <StaffManager users={users} />
    </div>
  );
}
