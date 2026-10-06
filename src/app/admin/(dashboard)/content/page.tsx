import { requirePermission } from "@/lib/auth/rbac";
import { listAnnouncementsAdmin, listFaqAdmin, listPagesAdmin } from "@/server/actions/admin-ops";
import { PageHeader } from "@/components/admin/ui";
import { AnnouncementsManager, FaqManager, PagesManager } from "./content-managers";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  await requirePermission("content:write");
  const [pages, faq, announcements] = await Promise.all([
    listPagesAdmin(),
    listFaqAdmin(),
    listAnnouncementsAdmin(),
  ]);
  return (
    <div className="space-y-10">
      <PageHeader title="Contenu" description="Pages légales, FAQ et bandeau d’annonce." />
      <AnnouncementsManager items={announcements} />
      <FaqManager items={faq} />
      <PagesManager pages={pages} />
    </div>
  );
}
