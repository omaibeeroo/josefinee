"use client";

import { useEffect } from "react";
import Script from "next/script";

export function consentGiven(): boolean {
  // Default-off: marketing pixels load only after an explicit opt-in
  // through cookie preferences. No banner ever interrupts shopping.
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("nur-cookie-consent") === "accepted";
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
}: {
  gaId: string;
  metaPixelId: string;
  tiktokPixelId: string;
}) {
  useEffect(() => {
    const onConsent = () => window.location.reload();
    window.addEventListener("nur-consent", onConsent);
    return () => window.removeEventListener("nur-consent", onConsent);
  }, []);

  if (!consentGiven()) return null;

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};window.gtag=gtag;gtag('js',new Date());gtag('config','${gaId}');`}
          </Script>
        </>
      )}
      {metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {tiktokPixelId && (
        <Script
          src={`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${tiktokPixelId}&lib=ttq`}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}

/** Declarative conversion event, e.g. `<PixelEvent name="ViewContent" params={...} />`. */
export function PixelEvent({ name, params }: { name: string; params?: Record<string, unknown> }) {
  useEffect(() => {
    pixelEvent(name, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return null;
}
