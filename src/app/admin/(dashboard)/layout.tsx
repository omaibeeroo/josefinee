import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { permissionCodes } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

type Section = { title: string; items: Array<{ href: string; label: string; badge?: number }> };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const { user } = session;

  if (user.mustChangePassword) redirect("/admin/first-login");

  const codes = new Set(permissionCodes(user));
  const has = (code: string) => user.role.name === "SUPER_ADMIN" || codes.has(code);

  let pendingOrders = 0;
  if (has("orders:read")) {
    pendingOrders = await prisma.order.count({ where: { status: "PENDING" } }).catch(() => 0);
  }

  const sections: Section[] = [];
  const dashboard: Section = { title: "Overview", items: [] };
  if (has("dashboard:read")) dashboard.items.push({ href: "/admin", label: "Dashboard" });
  if (has("analytics:read")) dashboard.items.push({ href: "/admin/analytics", label: "Analytics" });
  if (dashboard.items.length > 0) sections.push(dashboard);

  const sales: Section = { title: "Sales", items: [] };
  if (has("orders:read"))
    sales.items.push({ href: "/admin/orders", label: "Orders", badge: pendingOrders });
  if (has("customers:read")) sales.items.push({ href: "/admin/customers", label: "Customers" });
  if (has("coupons:read")) sales.items.push({ href: "/admin/coupons", label: "Coupons" });
  if (has("coupons:read")) sales.items.push({ href: "/admin/promotions", label: "Promotions" });
  if (has("reviews:moderate")) sales.items.push({ href: "/admin/reviews", label: "Reviews" });
  if (sales.items.length > 0) sections.push(sales);

  const catalog: Section = { title: "Catalog", items: [] };
  if (has("products:read")) catalog.items.push({ href: "/admin/products", label: "Products" });
  if (has("catalog:write")) {
    catalog.items.push({ href: "/admin/categories", label: "Categories" });
    catalog.items.push({ href: "/admin/collections", label: "Collections" });
  }
  if (has("inventory:read")) catalog.items.push({ href: "/admin/inventory", label: "Inventory" });
  if (catalog.items.length > 0) sections.push(catalog);

  const ops: Section = { title: "Operations", items: [] };
  if (has("delivery:read")) ops.items.push({ href: "/admin/delivery", label: "Delivery" });
  if (has("messages:read")) ops.items.push({ href: "/admin/messages", label: "Messages" });
  if (has("dashboard:read")) ops.items.push({ href: "/admin/newsletter", label: "Newsletter" });
  if (has("content:write")) ops.items.push({ href: "/admin/content", label: "Content" });
  if (ops.items.length > 0) sections.push(ops);

  const system: Section = { title: "System", items: [] };
  if (has("settings:read")) system.items.push({ href: "/admin/settings", label: "Settings" });
  if (has("users:manage")) system.items.push({ href: "/admin/users", label: "Staff" });
  if (has("audit:read")) system.items.push({ href: "/admin/audit", label: "Audit trail" });
  system.items.push({ href: "/admin/security", label: "My security" });
  sections.push(system);

  return (
    <AdminShell
      name={user.name}
      roleLabel={user.role.label}
      sections={sections}
      pendingOrders={pendingOrders}
    >
      {children}
    </AdminShell>
  );
}
