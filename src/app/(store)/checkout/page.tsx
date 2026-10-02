import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getCheckoutData } from "@/server/actions/checkout";
import { EmptyState } from "@/components/ui";
import { CheckoutForm } from "./checkout-form";
import { PixelEvent } from "@/components/pixels";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finaliser ma commande",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [{ cart, wilayas, promotion }, settings] = await Promise.all([getCheckoutData(), getSettings()]);

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="container-luxe py-10 md:py-14">
        <EmptyState
          title="Votre panier est vide"
          message="Ajoutez des articles avant de finaliser votre commande."
          action={
            <Link href="/shop" className="btn btn-primary">
              Découvrir la boutique
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
        <p className="eyebrow mb-2">Paiement à la livraison</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Finaliser ma commande</h1>
        <p className="mt-3 text-ink-soft">Réglez en espèces à la réception de votre commande. Aucune carte nécessaire.</p>
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
