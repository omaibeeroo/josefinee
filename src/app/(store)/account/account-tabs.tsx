"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account", label: "Aperçu", exact: true },
  { href: "/account/orders", label: "Commandes" },
  { href: "/account/wishlist", label: "Favoris" },
  { href: "/account/addresses", label: "Adresses" },
  { href: "/account/security", label: "Sécurité" },
];

export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Compte" className="flex gap-1 overflow-x-auto border-b hairline">
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
