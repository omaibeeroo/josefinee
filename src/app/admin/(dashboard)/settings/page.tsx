import { requirePermission } from "@/lib/auth/rbac";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { SettingsEditor } from "./settings-editor";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePermission("settings:read");
  const settings = await getSettings();
  return (
    <div>
      <PageHeader title="Réglages" description="Marque, boutique, commerce et intégrations. Les changements s’appliquent aussitôt." />
      <SettingsEditor initial={settings} />
    </div>
  );
}
