import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/rbac";
import { getAdminOrder } from "@/server/actions/admin-orders";
import { getSettings } from "@/lib/settings";
import { formatDA } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function PrintSlipPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("orders:read");
  const { id } = await params;
  const order = await getAdminOrder(id).catch(() => null);
  if (!order) notFound();
  const [settings, requestHeaders] = await Promise.all([getSettings(), headers()]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-sm text-black">
      <div className="flex items-start justify-between border-b-2 border-black pb-4">
        <div>
          <p className="font-display text-2xl tracking-[0.24em]">{settings.general.name}</p>
          <p className="text-xs">{settings.general.phone} · {settings.general.email}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">PACKING SLIP</p>
          <p>{order.orderNumber}</p>
          <p className="text-xs">{new Date(order.placedAt).toLocaleString("fr-DZ")}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="font-bold">Deliver to</p>
          <p>
            {order.firstName} {order.lastName}
          </p>
          <p>{formatPhoneDisplay(order.phone)}</p>
          <p>
            {order.address}, {order.communeName}, {order.wilayaName}
          </p>
          {order.notes && <p className="mt-1 italic">Note: {order.notes}</p>}
        </div>
        <div className="text-right">
          <p className="font-bold">Payment</p>
          <p>Cash on delivery</p>
          <p className="mt-2 text-xl font-bold">Collect: {formatDA(order.total)}</p>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2">Product</th>
            <th className="py-2">SKU</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit</th>
            <th className="py-2 text-right">Line</th>
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
        <p>Subtotal: {formatDA(order.subtotal)}</p>
        {order.promotionDiscount > 0 && <p>Promotion: −{formatDA(order.promotionDiscount)}</p>}
        <p>Discount: −{formatDA(order.discount)}</p>
        <p>Delivery: {formatDA(order.shipping)}</p>
        <p className="text-lg font-bold">Total: {formatDA(order.total)}</p>
      </div>

      <p className="mt-8 border-t border-black/20 pt-2 text-xs">☐ Packed &nbsp;&nbsp; ☐ Checked &nbsp;&nbsp; Signature: __________</p>

      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: "window.addEventListener('load', () => window.print());" }} />
    </div>
  );
}
