import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { getAdminOrder } from "@/server/actions/admin-orders";
import { getSettings } from "@/lib/settings";
import { formatDA, formatDateTimeFR } from "@/lib/money";
import { getDictionary } from "@/lib/i18n/server";
import { formatPhoneDisplay } from "@/lib/phone";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function PrintSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("orders:read");
  const { id } = await params;
  const order = await getAdminOrder(id).catch(() => null);
  if (!order) notFound();
  const [settings, requestHeaders, t] = await Promise.all([getSettings(), headers(), getDictionary()]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-sm text-black">
      <div className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <p className="font-display text-2xl tracking-[0.24em]">{settings.general.name}</p>
          <p className="text-xs">{settings.general.phone} · {settings.general.email}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">{t.adminPrint.packingSlip}</p>
          <p>{order.orderNumber}</p>
          <p className="text-xs">{formatDateTimeFR(order.placedAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="font-bold">{t.adminPrint.deliverTo}</p>
          <p>
            {order.firstName} {order.lastName}
          </p>
          <p>{formatPhoneDisplay(order.phone)}</p>
          <p>
            {order.address}, {order.communeName}, {order.wilayaName}
          </p>
          {order.notes && <p className="mt-1 italic">{t.adminPrint.note} {order.notes}</p>}
        </div>
        <div className="text-right">
          <p className="font-bold">{t.adminPrint.payment}</p>
          <p>{t.adminPrint.cod}</p>
          <p className="mt-2 text-xl font-bold">{t.adminPrint.collect} {formatDA(order.total)}</p>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2">{t.adminPrint.product}</th>
            <th className="py-2">{t.adminPrint.sku}</th>
            <th className="py-2 text-right">{t.adminPrint.qty}</th>
            <th className="py-2 text-right">{t.adminPrint.unit}</th>
            <th className="py-2 text-right">{t.adminPrint.line}</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-black/20">
              <td className="py-2">
                {item.productName}
                {item.variantLabel ? ` (${item.variantLabel})` : ""}
              </td>
              <td className="py-2">{item.sku ?? "—"}</td>
              <td className="py-2 text-right font-bold">{item.quantity}</td>
              <td className="py-2 text-right">{formatDA(item.unitPrice)}</td>
              <td className="py-2 text-right">{formatDA(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 space-y-1 text-right">
        <p>{t.adminPrint.subtotal}: {formatDA(order.subtotal)}</p>
        {order.promotionDiscount > 0 && <p>{t.adminPrint.promotion}: −{formatDA(order.promotionDiscount)}</p>}
        <p>{t.adminPrint.discount}: −{formatDA(order.discount)}</p>
        <p>{t.adminPrint.delivery}: {formatDA(order.shipping)}</p>
        <p className="text-lg font-bold">{t.adminPrint.total}: {formatDA(order.total)}</p>
      </div>

      <p className="mt-8 border-t border-black/20 pt-2 text-xs">☐ {t.adminPrint.packed} &nbsp;&nbsp; ☐ {t.adminPrint.checked} &nbsp;&nbsp; {t.adminPrint.signature} __________</p>

      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: "window.addEventListener('load', () => window.print());" }} />
    </div>
  );
}
