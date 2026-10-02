"use client";

import { useState, type FormEvent } from "react";
import { saveSettingsAction } from "@/server/actions/admin-ops";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { SettingsMap } from "@/lib/settings";
import { cn } from "@/lib/utils";

type SectionKey = keyof SettingsMap;

const TABS: Array<{ key: SectionKey; label: string }> = [
  { key: "general", label: "Store" },
  { key: "homepage", label: "Homepage" },
  { key: "commerce", label: "Commerce" },
  { key: "seo", label: "SEO" },
  { key: "social", label: "Social" },
  { key: "analytics", label: "Analytics" },
  { key: "notifications", label: "Notifications" },
];

export function SettingsEditor({ initial }: { initial: SettingsMap }) {
  const [tab, setTab] = useState<SectionKey>("general");
  const [values, setValues] = useState<SettingsMap>(initial);
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  function set(path: string, value: string | number | boolean) {
    setValues((previous) => {
      const next = structuredClone(previous);
      const parts = path.split(".");
      let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let index = 0; index < parts.length - 1; index += 1) {
        target = target[parts[index] as string] as Record<string, unknown>;
      }
      target[parts[parts.length - 1] as string] = value;
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setState(null);
    const result = await saveSettingsAction(tab, values[tab]);
    setPending(false);
    setState({ ok: result.ok, message: result.ok ? "Settings saved." : result.error });
  }

  const general = values.general;
  const homepage = values.homepage;
  const commerce = values.commerce;

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 border hairline bg-white p-1" role="tablist" aria-label="Settings sections">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            onClick={() => { setTab(entry.key); setState(null); }}
            className={cn(
              "px-4 py-2 text-xs font-medium uppercase tracking-[0.12em]",
              tab === entry.key ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4 border hairline bg-white p-5">
        {tab === "general" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Store name"><Input value={general.name} onChange={(event) => set("general.name", event.target.value)} /></Field>
              <Field label="Tagline"><Input value={general.tagline} onChange={(event) => set("general.tagline", event.target.value)} /></Field>
              <Field label="Support email"><Input value={general.email} onChange={(event) => set("general.email", event.target.value)} /></Field>
              <Field label="Support phone"><Input value={general.phone} onChange={(event) => set("general.phone", event.target.value)} /></Field>
              <Field label="Logo URL"><Input value={general.logoUrl} onChange={(event) => set("general.logoUrl", event.target.value)} placeholder="https://…" /></Field>
              <Field label="Favicon URL"><Input value={general.faviconUrl} onChange={(event) => set("general.faviconUrl", event.target.value)} placeholder="https://…" /></Field>
            </div>
            <Field label="Address"><Input value={general.address} onChange={(event) => set("general.address", event.target.value)} /></Field>
            <Field label="Description"><Textarea value={general.description} onChange={(event) => set("general.description", event.target.value)} rows={3} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Accent color"><Input type="color" value={general.colors.accent} onChange={(event) => set("general.colors.accent", event.target.value)} className="h-12" /></Field>
              <Field label="Ink color"><Input type="color" value={general.colors.ink} onChange={(event) => set("general.colors.ink", event.target.value)} className="h-12" /></Field>
              <Field label="Background"><Input type="color" value={general.colors.background} onChange={(event) => set("general.colors.background", event.target.value)} className="h-12" /></Field>
            </div>
          </>
        )}

        {tab === "homepage" && (
          <>
            <Field label="Announcement text">
              <Input value={homepage.announcement.text} onChange={(event) => set("homepage.announcement.text", event.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Announcement link"><Input value={homepage.announcement.href} onChange={(event) => set("homepage.announcement.href", event.target.value)} /></Field>
              <label className="flex items-center gap-2 self-end pb-3 text-sm">
                <input type="checkbox" checked={homepage.announcement.isActive} onChange={(event) => set("homepage.announcement.isActive", event.target.checked)} className="h-4 w-4 accent-[#1c1a17]" />
                Announcement active
              </label>
            </div>
            <Field label="Hero eyebrow"><Input value={homepage.hero.eyebrow} onChange={(event) => set("homepage.hero.eyebrow", event.target.value)} /></Field>
            <Field label="Hero headline"><Textarea value={homepage.hero.headline} onChange={(event) => set("homepage.hero.headline", event.target.value)} rows={2} /></Field>
            <Field label="Hero subheading"><Textarea value={homepage.hero.subheading} onChange={(event) => set("homepage.hero.subheading", event.target.value)} rows={2} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary button label"><Input value={homepage.hero.primaryLabel} onChange={(event) => set("homepage.hero.primaryLabel", event.target.value)} /></Field>
              <Field label="Primary button link"><Input value={homepage.hero.primaryHref} onChange={(event) => set("homepage.hero.primaryHref", event.target.value)} /></Field>
              <Field label="Secondary button label"><Input value={homepage.hero.secondaryLabel} onChange={(event) => set("homepage.hero.secondaryLabel", event.target.value)} /></Field>
              <Field label="Secondary button link"><Input value={homepage.hero.secondaryHref} onChange={(event) => set("homepage.hero.secondaryHref", event.target.value)} /></Field>
              <Field label="Hero image (desktop)"><Input value={homepage.hero.imageDesktop} onChange={(event) => set("homepage.hero.imageDesktop", event.target.value)} placeholder="https://…" /></Field>
              <Field label="Hero image (mobile)"><Input value={homepage.hero.imageMobile} onChange={(event) => set("homepage.hero.imageMobile", event.target.value)} placeholder="https://…" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Featured collection slug"><Input value={homepage.featuredCollectionSlug} onChange={(event) => set("homepage.featuredCollectionSlug", event.target.value)} /></Field>
              <Field label="Social proof count (0 = real delivered orders)">
                <Input type="number" min={0} value={homepage.socialProofOverride} onChange={(event) => set("homepage.socialProofOverride", Number(event.target.value) || 0)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={homepage.showSocialProof} onChange={(event) => set("homepage.showSocialProof", event.target.checked)} className="h-4 w-4 accent-[#1c1a17]" />
              Show social proof section
            </label>
          </>
        )}

        {tab === "commerce" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Order number prefix"><Input value={commerce.orderPrefix} onChange={(event) => set("commerce.orderPrefix", event.target.value.toUpperCase())} maxLength={8} /></Field>
              <Field label="Free delivery threshold (DA, 0 = off)">
                <Input type="number" min={0} value={commerce.freeDeliveryThreshold} onChange={(event) => set("commerce.freeDeliveryThreshold", Number(event.target.value) || 0)} />
              </Field>
              <Field label="Default delivery method">
                <Select value={commerce.defaultDeliveryMethod} onChange={(event) => set("commerce.defaultDeliveryMethod", event.target.value)}>
                  <option value="HOME">Home delivery</option>
                  <option value="STOPDESK">Stopdesk</option>
                  <option value="EXPRESS">Express</option>
                  <option value="STANDARD">Standard</option>
                </Select>
              </Field>
              <Field label="Default low-stock threshold">
                <Input type="number" min={0} value={commerce.lowStockThresholdDefault} onChange={(event) => set("commerce.lowStockThresholdDefault", Number(event.target.value) || 0)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={commerce.codEnabled} onChange={(event) => set("commerce.codEnabled", event.target.checked)} className="h-4 w-4 accent-[#1c1a17]" />
              Cash on delivery enabled
            </label>
          </>
        )}

        {tab === "seo" && (
          <>
            <Field label="Title suffix"><Input value={values.seo.titleSuffix} onChange={(event) => set("seo.titleSuffix", event.target.value)} /></Field>
            <Field label="Default description"><Textarea value={values.seo.defaultDescription} onChange={(event) => set("seo.defaultDescription", event.target.value)} rows={3} /></Field>
            <Field label="Default social image"><Input value={values.seo.defaultOgImage} onChange={(event) => set("seo.defaultOgImage", event.target.value)} placeholder="https://…" /></Field>
          </>
        )}

        {tab === "social" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instagram"><Input value={values.social.instagram} onChange={(event) => set("social.instagram", event.target.value)} /></Field>
            <Field label="TikTok"><Input value={values.social.tiktok} onChange={(event) => set("social.tiktok", event.target.value)} /></Field>
            <Field label="Facebook"><Input value={values.social.facebook} onChange={(event) => set("social.facebook", event.target.value)} /></Field>
            <Field label="WhatsApp number"><Input value={values.social.whatsapp} onChange={(event) => set("social.whatsapp", event.target.value)} placeholder="213…" /></Field>
          </div>
        )}

        {tab === "analytics" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Google Analytics ID" hint="Pixels load only after cookie consent">
              <Input value={values.analytics.gaId} onChange={(event) => set("analytics.gaId", event.target.value)} placeholder="G-…" />
            </Field>
            <Field label="Meta Pixel ID"><Input value={values.analytics.metaPixelId} onChange={(event) => set("analytics.metaPixelId", event.target.value)} /></Field>
            <Field label="TikTok Pixel ID"><Input value={values.analytics.tiktokPixelId} onChange={(event) => set("analytics.tiktokPixelId", event.target.value)} /></Field>
          </div>
        )}

        {tab === "notifications" && (
          <div className="space-y-3 text-sm">
            <p className="text-ink-soft">Providers are configured through environment variables. These toggles control whether each channel is used.</p>
            {(
              [
                ["orderEmailEnabled", "Order emails"],
                ["orderSmsEnabled", "Order SMS"],
                ["orderWhatsappEnabled", "Order WhatsApp messages"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={values.notifications[key]}
                  onChange={(event) => set(`notifications.${key}`, event.target.checked)}
                  className="h-4 w-4 accent-[#1c1a17]"
                />
                {label}
              </label>
            ))}
          </div>
        )}

        {state && (
          <p className={`text-sm ${state.ok ? "text-ink-soft" : "text-sale"}`} role="status">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </div>
  );
}
