"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";
import { adminLogoutAction } from "@/server/actions/admin-auth";
import { cn } from "@/lib/utils";
import { useDialogFocus } from "@/components/ui";

export type NavItem = { href: string; label: string; badge?: number };

export function AdminShell({
  children,
  name,
  roleLabel,
  sections,
  pendingOrders,
}: {
  children: ReactNode;
  name: string;
  roleLabel: string;
  sections: Array<{ title: string; items: NavItem[] }>;
  pendingOrders: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const menuPanelRef = useRef<HTMLElement>(null);
  useDialogFocus(menuOpen, menuPanelRef, () => setMenuOpen(false));

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-cream">
      {/* Topbar */}
      <div className="sticky top-0 z-40 border-b hairline bg-ivory print:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation" className="p-2 lg:hidden">
              <Menu size={20} />
            </button>
            <Link href="/admin" className="font-display text-lg tracking-[0.28em]">
              Josefinee <span className="text-xs tracking-[0.2em] text-ink-muted">ADMIN</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/orders?status=PENDING"
              className="relative flex items-center gap-1.5 text-sm"
              onClick={() => router.refresh()}
              title="Pending orders"
            >
              <Bell size={17} />
              {pendingOrders > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sale px-1.5 text-[0.6875rem] font-bold text-white">
                  {pendingOrders}
                </span>
              )}
            </Link>
            <Link href="/" target="_blank" className="hidden text-xs uppercase tracking-[0.14em] underline underline-offset-2 sm:inline">
              View store
            </Link>
            <span className="hidden text-xs text-ink-muted md:inline">
              {name} · {roleLabel}
            </span>
            <form action={adminLogoutAction}>
              <button type="submit" className="text-xs uppercase tracking-[0.14em] underline underline-offset-2">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 border-r hairline bg-ivory lg:block print:hidden" aria-label="Admin navigation">
          <nav className="sticky top-[57px] max-h-[calc(100vh-57px)] overflow-y-auto p-4">
            <SidebarNav sections={sections} pathname={pathname} />
          </nav>
        </aside>

        {/* Sidebar (mobile drawer) */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
            <button aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-ink/50" />
            <aside ref={menuPanelRef} tabIndex={-1} className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-ivory p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display text-lg tracking-[0.12em]">Josefinee</span>
                <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" className="p-2">
                  <X size={20} />
                </button>
              </div>
              <SidebarNav sections={sections} pathname={pathname} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
      <NewOrderAlerts initialPending={pendingOrders} />
    </div>
  );
}

function SidebarNav({ sections, pathname }: { sections: Array<{ title: string; items: NavItem[] }>; pathname: string }) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-between rounded-sm px-2 py-2 text-sm",
                      active ? "bg-ink font-medium text-ivory" : "text-ink-soft hover:bg-cream hover:text-ink",
                    )}
                  >
                    {item.label}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={cn("rounded-full px-1.5 text-[0.6875rem] font-bold", active ? "bg-ivory text-ink" : "bg-sale text-white")}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function NewOrderAlerts({ initialPending }: { initialPending: number }) {
  const [, setKnown] = useState(initialPending);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch("/api/admin/alerts", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { pendingCount: number; latestOrderNumber: string | null };
        if (cancelled) return;
        setKnown((previous) => {
          if (data.pendingCount > previous) {
            setNotice(`New order ${data.latestOrderNumber ?? ""} — check pending orders.`);
            try {
              const audio = new AudioContext();
              const oscillator = audio.createOscillator();
              const gain = audio.createGain();
              oscillator.connect(gain);
              gain.connect(audio.destination);
              oscillator.frequency.value = 880;
              gain.gain.value = 0.08;
              oscillator.start();
              oscillator.stop(audio.currentTime + 0.25);
              setTimeout(() => void audio.close(), 500);
            } catch {
              // sound is a nice-to-have
            }
          }
          return data.pendingCount;
        });
      } catch {
        // polling must never break the dashboard
      }
    }
    const timer = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!notice) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[70] max-w-sm border hairline bg-ink p-4 text-ivory shadow-card print:hidden" role="alert">
      <p className="text-sm font-medium">New order received</p>
      <p className="mt-1 text-sm text-ivory/80">{notice}</p>
      <div className="mt-3 flex gap-2">
        <Link href="/admin/orders?status=PENDING" className="btn btn-gold min-h-9 px-4 text-[0.6875rem]">
          View orders
        </Link>
        <button type="button" onClick={() => setNotice(null)} className="btn min-h-9 border border-ivory/30 px-4 text-[0.6875rem] text-ivory">
          Dismiss
        </button>
      </div>
    </div>
  );
}
