import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { permissionCodes } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/shell";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

type Section = { title: string; items: Array<{ href: string; label: string; badge?: number }> };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const { user } = session;

  if (user.mustChangePassword) redirect("/admin/first-login");

  const codes = new Set(permissionCodes(user));
  const has = (code: string) => user.role.name === "SUPER_ADMIN" || codes.has(code);

  const t = await getDictionary();
  let pendingOrders = 0;
  if (has("orders:read")) {
    pendingOrders = await prisma.order.count({ where: { status: "PENDING" } }).catch(() => 0);
  }

  const sections: Section[] = [];
  const dashboard: Section = { title: t.admin.overview, items: [] };
  if (has("dashboard:read")) dashboard.items.push({ href: "/admin", label: t.admin.dashboard });
  if (has("analytics:read")) dashboard.items.push({ href: "/admin/analytics", label: t.admin.analytics });
  if (dashboard.items.length > 0) sections.push(dashboard);

  const sales: Section = { title: t.admin.sales, items: [] };
  if (has("orders:read"))
    sales.items.push({ href: "/admin/orders", label: t.admin.orders, badge: pendingOrders });
  if (has("customers:read")) sales.items.push({ href: "/admin/customers", label: t.admin.customers });
  if (has("coupons:read")) sales.items.push({ href: "/admin/coupons", label: t.admin.coupons });
  if (has("promotions:read")) sales.items.push({ href: "/admin/promotions", label: t.admin.promotions });
  if (has("reviews:moderate")) sales.items.push({ href: "/admin/reviews", label: t.admin.reviews });
  if (sales.items.length > 0) sections.push(sales);

  const catalog: Section = { title: t.admin.catalog, items: [] };
  if (has("products:read")) catalog.items.push({ href: "/admin/products", label: t.admin.products });
  if (has("catalog:write")) {
    catalog.items.push({ href: "/admin/categories", label: t.admin.categories });
    catalog.items.push({ href: "/admin/collections", label: t.admin.collections });
  }
  if (has("inventory:read")) catalog.items.push({ href: "/admin/inventory", label: t.admin.inventory });
  if (catalog.items.length > 0) sections.push(catalog);

  const ops: Section = { title: t.admin.operations, items: [] };
  if (has("delivery:read")) ops.items.push({ href: "/admin/delivery", label: t.admin.delivery });
  if (has("messages:read")) ops.items.push({ href: "/admin/messages", label: t.admin.messages });
  if (has("newsletter:read")) ops.items.push({ href: "/admin/newsletter", label: t.admin.newsletter });
  if (has("content:write")) ops.items.push({ href: "/admin/content", label: t.admin.content });
  if (ops.items.length > 0) sections.push(ops);

  const system: Section = { title: t.admin.system, items: [] };
  if (has("settings:read")) system.items.push({ href: "/admin/settings", label: t.admin.settings });
  if (has("users:manage")) system.items.push({ href: "/admin/users", label: t.admin.staff });
  if (has("audit:read")) system.items.push({ href: "/admin/audit", label: t.admin.audit });
  system.items.push({ href: "/admin/security", label: t.admin.security });
  sections.push(system);

  return (
    <AdminShell
      name={user.name}
      roleLabel={user.role.label}
      roleName={user.role.name}
      sections={sections}
      pendingOrders={pendingOrders}
    >
      {children}
    </AdminShell>
  );
}
