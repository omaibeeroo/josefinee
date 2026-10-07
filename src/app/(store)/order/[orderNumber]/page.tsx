import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getOrderConfirmation } from "@/server/orders";
import { getSettings } from "@/lib/settings";
import { verifyOrderToken } from "@/lib/order-token";
import { CUSTOMER_ORDER_FLOW } from "@/lib/constants";
import { formatDA } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import { getDictionary } from "@/lib/i18n/server";
import { PixelEvent } from "@/components/pixels";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const d = await getDictionary();
  return { title: d.order.confirmed, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderNumber } = await params;
  const { t } = await searchParams;
  const normalized = orderNumber.trim().toUpperCase();

  if (!verifyOrderToken(normalized, t)) notFound();

  const order = await getOrderConfirmation(normalized);
  if (!order) notFound();
  const [settings, d] = await Promise.all([getSettings(), getDictionary()]);
  const whatsappNumber = settings.social.whatsapp.replace(/\D/g, "");
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        d.order.whatsappMsg.replace("{order}", order.orderNumber),
      )}`
    : null;

  const reachedIndex = CUSTOMER_ORDER_FLOW.indexOf(order.status);
  const activeIndex = reachedIndex === -1 ? 0 : reachedIndex;

  return (
    <div className="container-luxe max-w-3xl py-12 md:py-16">
      <PixelEvent
        name="Purchase"
        params={{
          value: order.total / 100,
          currency: "DZD",
          eventID: `purchase-${order.orderNumber}`,
          event_id: `purchase-${order.orderNumber}`,
        }}
      />
      <div className="text-center">
        <CheckCircle2 size={44} strokeWidth={1.25} className="mx-auto text-success" />
        <p className="eyebrow mt-4">{d.order.confirmed}</p>
        <h1 className="mt-2 font-display text-4xl font-medium md:text-5xl">
          {d.order.thanks.replace("{name}", order.firstName)}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          {d.order.prepareNote.replace("{phone}", formatPhoneDisplay(order.phone))}
        </p>
        <p className="mt-4 inline-block border hairline bg-white px-5 py-2.5 text-sm tracking-[0.12em]">
          {d.order.order} <span className="font-semibold">{order.orderNumber}</span>
        </p>
      </div>

      <ol className="mt-10" aria-label={d.order.progress}>
        {CUSTOMER_ORDER_FLOW.map((status, index) => {
          const done = index <= activeIndex;
          return (
            <li key={status} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs",
                    done ? "border-ink bg-ink text-ivory" : "hairline bg-white text-ink-muted",
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {index < CUSTOMER_ORDER_FLOW.length - 1 && (
                  <span className={cn("h-8 w-px", done ? "bg-ink" : "bg-line")} aria-hidden="true" />
                )}
              </div>
              <p className={cn("pb-6 text-sm", done ? "font-medium" : "text-ink-muted")}>
                {d.customerStatus[status]}
                {index === activeIndex && <span className="ml-2 text-xs text-gold-dark">· {d.order.current}</span>}
              </p>
            </li>
          );
        })}
      </ol>

      <div className="border hairline bg-white p-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em]">{d.order.summary}</h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item, index) => (
            <li key={`${item.productName}-${index}`} className="flex items-center gap-3">
              <div className="relative h-14 w-12 shrink-0 overflow-hidden bg-cream">
                {item.imageUrl && (
                  <Image src={item.imageUrl} alt={item.productName} fill sizes="48px" className="object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-ink-muted">
                  {item.variantLabel ? `${item.variantLabel} · ` : ""}{d.order.qty} {item.quantity}
                </p>
              </div>
              <p className="text-sm font-medium">{formatDA(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t hairline pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">{d.order.subtotal}</dt>
            <dd>{formatDA(order.subtotal)}</dd>
          </div>
          {order.promotionDiscount > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">{d.order.promotion}{order.promotionName ? ` (${order.promotionName})` : ""}</dt>
              <dd>−{formatDA(order.promotionDiscount)}</dd>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-soft">{d.order.discount}</dt>
              <dd>−{formatDA(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink-soft">{d.order.delivery} ({d.delivery[order.deliveryMethod]})</dt>
            <dd>{formatDA(order.shipping)}</dd>
          </div>
          <div className="flex justify-between text-base font-medium">
            <dt>{d.order.totalCod}</dt>
            <dd>{formatDA(order.total)}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t hairline pt-4 text-sm text-ink-soft">
          <p>
            {order.firstName} {order.lastName} · {formatPhoneDisplay(order.phone)}
          </p>
          <p className="mt-1">
            {order.address}, {order.communeName}, {order.wilayaName}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/shop" className="btn btn-primary">
          {d.cart.continueShopping}
        </Link>
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-gold">
            {d.order.whatsappCta}
          </a>
        ) : (
          <Link href="/contact" className="btn btn-ghost">
          {d.order.contactSupport}
          </Link>
        )}
        <Link href={`/order/${order.orderNumber}?t=${encodeURIComponent(t ?? "")}`} className="btn btn-ghost">
          {d.order.refreshStatus}
        </Link>
      </div>
    </div>
  );
}
