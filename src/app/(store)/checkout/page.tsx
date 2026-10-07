import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getCheckoutData } from "@/server/actions/checkout";
import { getDictionary } from "@/lib/i18n/server";
import { EmptyState } from "@/components/ui";
import { CheckoutForm } from "./checkout-form";
import { PixelEvent } from "@/components/pixels";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.checkout.title, robots: { index: false, follow: false } };
}

export default async function CheckoutPage() {
  const [{ cart, wilayas, promotion }, settings, t] = await Promise.all([
    getCheckoutData(),
    getSettings(),
    getDictionary(),
  ]);

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="checkout-page container-luxe py-10 md:py-14">
        <EmptyState
          title={t.checkout.emptyTitle}
          message={t.checkout.emptyHint}
          action={
            <Link href="/shop" className="btn btn-primary">
              {t.common.discoverShop}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="checkout-page container-luxe py-10 md:py-14">
      <PixelEvent name="InitiateCheckout" />
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">{t.checkout.eyebrow}</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">{t.checkout.title}</h1>
        <p className="mt-3 text-ink-soft">
          {t.checkout.subtitle}
        </p>
      </div>
      <CheckoutForm
        wilayas={wilayas}
        initialCart={{
          items: cart.lines,
          subtotal: cart.subtotal,
          count: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
        }}
        freeDeliveryThreshold={settings.commerce.freeDeliveryThreshold}
        defaultDeliveryMethod={settings.commerce.defaultDeliveryMethod}
        promotion={promotion}
      />
    </div>
  );
}
