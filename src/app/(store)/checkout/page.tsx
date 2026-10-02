import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getCheckoutData } from "@/server/actions/checkout";
import { EmptyState } from "@/components/ui";
import { CheckoutForm } from "./checkout-form";
import { PixelEvent } from "@/components/pixels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [{ cart, wilayas, promotion }, settings] = await Promise.all([getCheckoutData(), getSettings()]);

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="container-luxe py-10 md:py-14">
        <EmptyState
          title="Your bag is empty"
          message="Add some pieces before checking out."
          action={
            <Link href="/shop" className="btn btn-primary">
              Start shopping
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-luxe py-10 md:py-14">
      <PixelEvent name="InitiateCheckout" />
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">Cash on delivery</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Checkout</h1>
        <p className="mt-3 text-ink-soft">Pay in cash when your order arrives. No card needed.</p>
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
