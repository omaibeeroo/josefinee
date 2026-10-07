import { requirePermission } from "@/lib/auth/rbac";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { SettingsEditor } from "./settings-editor";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePermission("settings:read");
  const [settings, t] = await Promise.all([getSettings(), getDictionary()]);
  return (
    <div>
      <PageHeader title={t.adminPages.settingsTitle} description={t.adminPages.settingsDesc} />
      <SettingsEditor initial={settings} />
    </div>
  );
}