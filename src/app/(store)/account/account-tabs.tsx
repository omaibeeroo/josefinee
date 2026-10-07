"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/provider";

export function AccountTabs() {
  const { t } = useLocale();
  const pathname = usePathname();
  const TABS = [
    { href: "/account", label: t.account.overview, exact: true },
    { href: "/account/orders", label: t.account.orders },
    { href: "/account/wishlist", label: t.account.wishlist },
    { href: "/account/addresses", label: t.account.addresses },
    { href: "/account/security", label: t.account.security },
  ];
  return (
    <nav aria-label={t.account.account} className="flex gap-1 overflow-x-auto border-b hairline">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-[0.14em]",
              active ? "border-b-2 border-ink text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
