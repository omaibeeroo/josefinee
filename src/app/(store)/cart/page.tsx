import type { Metadata } from "next";
import { getDeliveryFloor } from "@/server/delivery";
import { getDictionary } from "@/lib/i18n/server";
import { CartLines } from "./cart-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: t.cart.title, robots: { index: false, follow: false } };
}

export default async function CartPage() {
  const [floor, t] = await Promise.all([getDeliveryFloor(), getDictionary()]);
  return (
    <div className="cart-page container-luxe py-10 md:py-14">
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">{t.cart.eyebrow}</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">{t.cart.title}</h1>
      </div>
      <CartLines floor={floor} />
    </div>
  );
}
