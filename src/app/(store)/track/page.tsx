import type { Metadata } from "next";
import { TrackForm } from "./track-form";

export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
};

export default function TrackPage() {
  return (
    <div className="container-luxe py-12 md:py-16">
      <div className="text-center">
        <p className="eyebrow mb-2">Order status</p>
        <h1 className="font-display text-4xl font-medium md:text-5xl">Track your order</h1>
        <p className="mt-3 text-ink-soft">Enter your order number and phone number to see the latest status.</p>
      </div>
      <TrackForm />
    </div>
  );
}
