import type { Metadata } from "next";
import { getDeliveryFloor } from "@/server/delivery";
import { CartLines } from "./cart-client";

export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const floor = await getDeliveryFloor();
  return (
    <div className="container-luxe py-10 md:py-14">
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">Your selection</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Shopping bag</h1>
      </div>
      <CartLines floor={floor} />
    </div>
  );
}
