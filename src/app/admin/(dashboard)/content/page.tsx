import { requirePermission } from "@/lib/auth/rbac";
import { listAnnouncementsAdmin, listFaqAdmin, listPagesAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { getDictionary } from "@/lib/i18n/server";
import { AnnouncementsManager, FaqManager, PagesManager } from "./content-managers";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  await requirePermission("content:write");
  const [pages, faq, announcements, t] = await Promise.all([
    listPagesAdmin(),
    listFaqAdmin(),
    listAnnouncementsAdmin(),
    getDictionary(),
  ]);
  return (
    <div className="space-y-10">
      <PageHeader title={t.adminPages.contentTitle} description={t.adminPages.contentDesc} />
      <AnnouncementsManager items={announcements} />
      <FaqManager items={faq} />
      <PagesManager pages={pages} />
    </div>
  );
}
