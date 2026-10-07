"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { serializeForInlineJsonScript, validatedPixelId } from "@/lib/script-data";

function consentGiven(): boolean {
  // Default-off: marketing pixels load only after an explicit opt-in
  // through cookie preferences. No banner ever interrupts shopping.
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("hanadi-cookie-consent") === "accepted";
  } catch {
    return false;
  }
}

/** Fires a conversion event to every configured, consented pixel. */
export function pixelEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !consentGiven()) return;
  try {
    const w = window as unknown as Record<string, unknown>;
    if (typeof w.fbq === "function") {
      (w.fbq as (event: string, name: string, params?: unknown) => void)("track", name, params);
    }
    if (typeof w.ttq === "object" && w.ttq !== null) {
      const ttq = w.ttq as { track?: (name: string, params?: unknown) => void };
      ttq.track?.(name, params);
    }
    if (typeof w.gtag === "function") {
      (w.gtag as (command: string, name: string, params?: unknown) => void)("event", name, params);
    }
  } catch {
    // Pixels must never break the shopping experience.
  }
}

export function Pixels({
  gaId,
  metaPixelId,
  tiktokPixelId,
  nonce,
}: {
  gaId: string;
  metaPixelId: string;
  tiktokPixelId: string;
  nonce?: string;
}) {
  const pathname = usePathname();
  const tokenizedRoute = pathname.startsWith("/order/") || pathname.startsWith("/newsletter/unsubscribe/");
  const safeGaId = validatedPixelId("ga", gaId);
  const safeMetaPixelId = validatedPixelId("meta", metaPixelId);
  const safeTiktokPixelId = validatedPixelId("tiktok", tiktokPixelId);

  useEffect(() => {
    const onConsent = () => window.location.reload();
    window.addEventListener("hanadi-consent", onConsent);
    return () => window.removeEventListener("hanadi-consent", onConsent);
  }, []);

  if (!consentGiven() || tokenizedRoute) return null;

  return (
    <>
      {safeGaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(safeGaId)}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          <Script id="ga-init" strategy="afterInteractive" nonce={nonce}>
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};window.gtag=gtag;gtag('js',new Date());gtag('config',${serializeForInlineJsonScript(safeGaId)});`}
          </Script>
        </>
      )}
      {safeMetaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive" nonce={nonce}>
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${serializeForInlineJsonScript(safeMetaPixelId)});fbq('track','PageView');`}
        </Script>
      )}
      {safeTiktokPixelId && (
        <Script
          src={`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(safeTiktokPixelId)}&lib=ttq`}
          strategy="afterInteractive"
          nonce={nonce}
        />
      )}
    </>
  );
}

/** Declarative conversion event, e.g. `<PixelEvent name="ViewContent" params={...} />`. */
export function PixelEvent({ name, params }: { name: string; params?: Record<string, unknown> }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/order/") || pathname.startsWith("/newsletter/unsubscribe/")) return;
    pixelEvent(name, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, pathname]);
  return null;
}
