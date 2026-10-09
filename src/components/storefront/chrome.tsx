"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Heart,
  Home,
  LayoutGrid,
  Menu,
  PackageSearch,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useCart } from "@/components/storefront/cart-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocale } from "@/lib/i18n/provider";
import { subscribeNewsletterAction } from "@/server/actions/engagement";
import { Honeypot, useDialogFocus } from "@/components/ui";
import { openCookieSettings } from "@/components/cookie-consent";
import { cn } from "@/lib/utils";

type NavCategory = {
  name: string;
  slug: string;
  children: Array<{ name: string; slug: string }>;
};

export type ChromeProps = {
  brandName: string;
  logoUrl: string;
  announcement: { text: string; href: string } | null;
  categories: NavCategory[];
  collections: Array<{ name: string; slug: string }>;
  social: { instagram: string; tiktok: string; facebook: string; whatsapp: string };
  supportEmail: string;
  supportPhone: string;
  popularSearches: string[];
};

function BrandMark({
  brandName,
  logoUrl,
  onClick,
  compact,
}: {
  brandName: string;
  logoUrl: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  const { t } = useLocale();
  return (
    <Link
      href="/"
      onClick={onClick}
      className={cn(
        "inline-flex origin-left items-center gap-2 motion-safe:transition-transform motion-safe:duration-300",
        compact && "motion-safe:scale-[0.82]",
      )}
      aria-label={t.header.brandHome.replace("{name}", brandName)}
    >
      {logoUrl ? (
        <Image src={logoUrl} alt={brandName} width={120} height={36} className="h-9 w-auto" />
      ) : (
        <span className="font-display text-[1.7rem] font-medium tracking-[0.32em]">
          {brandName}
        </span>
      )}
    </Link>
  );
}

function DesktopDropdown({
  label,
  href,
  children,
}: {
  label: string;
  /** Omit href for menu-only parents (e.g. categories) so the label toggles the menu instead of duplicating another nav link. */
  href?: string;
  children: ReactNode;
}) {
  const triggerClass =
    "nav-link flex items-center gap-1 whitespace-nowrap py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:text-gold-dark";
  return (
    <div className="group relative shrink-0">
      {href ? (
        <Link href={href} className={triggerClass}>
          {label}
          <ChevronDown size={12} className="transition-transform group-hover:rotate-180" />
        </Link>
      ) : (
        <button
          type="button"
          aria-haspopup="true"
          className={`${triggerClass} cursor-pointer bg-transparent`}
        >
          {label}
          <ChevronDown size={12} className="transition-transform group-hover:rotate-180" />
        </button>
      )}
      <div className="invisible absolute left-1/2 top-full z-50 max-h-[70vh] w-56 -translate-x-1/2 translate-y-1 overflow-y-auto overscroll-contain border hairline bg-white opacity-0 shadow-card transition-[opacity,transform] duration-200 ease-out group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 no-scrollbar">
        <div className="flex flex-col px-1.5 py-2">{children}</div>
      </div>
    </div>
  );
}

function DropdownLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2.5 text-xs tracking-[0.08em] text-ink-soft transition-colors hover:bg-cream/60 hover:text-ink"
    >
      {children}
    </Link>
  );
}

export function SiteChrome(props: ChromeProps & { children: ReactNode }) {
  const { brandName, announcement, children } = props;
  const { t } = useLocale();
  const { count, setOpen } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const mobileNavHidden =
    pathname.startsWith("/products/") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/cart");

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {announcement && (
        <div className="announcement-bar">
          <Link
            href={announcement.href}
            className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2 text-center text-[0.68rem] font-medium uppercase tracking-[0.2em]"
          >
            {announcement.text}
          </Link>
        </div>
      )}

      <header
        className={cn(
          "fixed inset-x-0 z-50 border-b bg-chrome backdrop-blur-md transition-[box-shadow,top] lg:sticky lg:inset-x-auto lg:top-0",
          !scrolled && announcement ? "top-8" : "top-0",
          scrolled ? "hairline shadow-[0_8px_30px_-18px_rgba(28,26,23,0.4)]" : "border-transparent",
        )}
      >
        {/* Desktop */}
        <div className="container-luxe hidden lg:block">
          <div className="relative flex h-16 items-center justify-center">
            <BrandMark brandName={brandName} logoUrl={props.logoUrl} compact={scrolled} />
            <div className="absolute right-0 flex items-center justify-end gap-1">
              <LocaleToggle className="mr-1 hidden xl:flex" />
              <ThemeToggle className="hidden lg:block" />
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label={t.header.search}
                className="icon-button p-2.5 hover:text-gold-dark"
              >
                <Search size={19} strokeWidth={1.75} />
              </button>
              <Link
                href="/account"
                aria-label={t.header.account}
                className="icon-button p-2.5 hover:text-gold-dark"
              >
                <User size={19} strokeWidth={1.75} />
              </Link>
              <Link
                href="/wishlist"
                aria-label={t.header.wishlist}
                className="icon-button p-2.5 hover:text-gold-dark"
              >
                <Heart size={19} strokeWidth={1.75} />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`${t.header.openCart}, ${count} ${count > 1 ? t.cart.items : t.cart.item}`}
                className="icon-button relative p-2.5 hover:text-gold-dark"
              >
                <ShoppingBag size={19} strokeWidth={1.75} />
                {count > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[0.625rem] font-semibold text-ivory">
                    {count}
                  </span>
                )}
              </button>
            </div>
          </div>
          <nav
            aria-label={t.header.mainNav}
            className="flex flex-wrap items-center justify-center gap-x-3 border-t hairline px-2 py-1 xl:gap-x-6"
          >
            <Link
              className="nav-link whitespace-nowrap px-2 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] hover:text-gold-dark"
              href="/"
            >
              {t.header.home}
            </Link>
            <Link
              className="nav-link whitespace-nowrap px-2 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] hover:text-gold-dark"
              href="/shop"
            >
              {t.header.shop}
            </Link>
            <DesktopDropdown label={t.header.categories}>
              <div className="flex flex-col px-3 py-1">
                {props.categories.map((category, index) => (
                  <div
                    key={category.slug}
                    className={index === 0 ? "py-2" : "border-t hairline py-2.5"}
                  >
                    <Link
                      href={`/categories/${category.slug}`}
                      className="block text-[10px] font-medium uppercase tracking-[0.2em] text-ink hover:text-gold-dark"
                    >
                      {category.name}
                    </Link>
                    {category.children.length > 0 && (
                      <div className="mt-1 flex flex-col">
                        {category.children.map((child) => (
                          <Link
                            key={child.slug}
                            href={`/categories/${child.slug}`}
                            className="py-1.5 text-[13px] text-ink-soft transition-colors hover:text-ink"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </DesktopDropdown>
            <DesktopDropdown label={t.header.collections} href="/collections">
              {props.collections.map((collection) => (
                <DropdownLink key={collection.slug} href={`/collections/${collection.slug}`}>
                  {collection.name}
                </DropdownLink>
              ))}
            </DesktopDropdown>
            <Link
              href="/collections/new-in"
              className="nav-link whitespace-nowrap px-2 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] hover:text-gold-dark"
            >
              {t.header.newIn}
            </Link>
            <Link
              href="/collections/best-sellers"
              className="nav-link whitespace-nowrap px-2 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] hover:text-gold-dark"
            >
              {t.header.bestSellers}
            </Link>
            <Link
              href="/collections/sale"
              className="whitespace-nowrap px-2 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-sale"
            >
              {t.header.sale}
            </Link>
          </nav>
        </div>

        {/* Mobile */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 py-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t.header.openMenu}
            className="p-3"
          >
            <Menu size={22} strokeWidth={1.75} />
          </button>
          <div className="flex justify-center">
            <BrandMark brandName={brandName} logoUrl={props.logoUrl} compact={scrolled} />
          </div>
          <div className="flex items-center">
            <ThemeToggle className="lg:hidden" />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t.header.search}
              className="p-2.5"
            >
              <Search size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`${t.header.openCart}, ${count} ${count > 1 ? t.cart.items : t.cart.item}`}
              className="relative p-2.5"
            >
              <ShoppingBag size={20} strokeWidth={1.75} />
              {count > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[0.625rem] font-semibold text-ivory">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      <div className="h-[3.75rem] lg:hidden" aria-hidden="true" />

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={props.categories}
        collections={props.collections}
        brandName={brandName}
        supportPhone={props.supportPhone}
      />
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        popularSearches={props.popularSearches}
      />
      <main
        key={pathname}
        className={cn(
          "page-enter",
          !mobileNavHidden && "pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0",
        )}
      >
        {children}
      </main>
      <SiteFooter {...props} />
      {!mobileNavHidden && <MobileAppNav count={count} onCart={() => setOpen(true)} />}
    </>
  );
}

/* ---------------------------------------------------- Mobile app navigation */

function MobileAppNav({ count, onCart }: { count: number; onCart: () => void }) {
  const pathname = usePathname();
  const { t } = useLocale();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/shop") {
      return ["/shop", "/search", "/collections", "/categories"].some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const itemClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pt-2 text-[0.58rem] font-medium uppercase tracking-[0.12em] transition-colors",
      active ? "text-ink" : "text-ink-muted hover:text-ink",
    );

  return (
    <nav
      aria-label={t.header.mobileNav}
      className="fixed inset-x-0 bottom-0 z-50 border-t hairline bg-chrome/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-14px_35px_-28px_rgb(29_35_43/0.65)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex h-[4.35rem] max-w-lg items-stretch px-2">
        <Link
          href="/"
          className={itemClass(isActive("/"))}
          aria-current={isActive("/") ? "page" : undefined}
        >
          <Home size={19} strokeWidth={isActive("/") ? 2 : 1.5} />
          <span>{t.header.home}</span>
        </Link>
        <Link
          href="/shop"
          className={itemClass(isActive("/shop"))}
          aria-current={isActive("/shop") ? "page" : undefined}
        >
          <LayoutGrid size={19} strokeWidth={isActive("/shop") ? 2 : 1.5} />
          <span>{t.header.shop}</span>
        </Link>
        <button
          type="button"
          onClick={onCart}
          aria-label={`${t.header.openCart}, ${count} ${count > 1 ? t.cart.items : t.cart.item}`}
          className={itemClass(false)}
        >
          <span className="relative">
            <ShoppingBag size={19} strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[0.55rem] font-semibold text-ivory">
                {count}
              </span>
            )}
          </span>
          <span>{t.header.openCart.replace(/^Ouvrir |^Open /, "")}</span>
        </button>
        <Link
          href="/wishlist"
          className={itemClass(isActive("/wishlist"))}
          aria-current={isActive("/wishlist") ? "page" : undefined}
        >
          <Heart size={19} strokeWidth={isActive("/wishlist") ? 2 : 1.5} />
          <span>{t.header.wishlist}</span>
        </Link>
        <Link
          href="/account"
          className={itemClass(isActive("/account"))}
          aria-current={isActive("/account") ? "page" : undefined}
        >
          <User size={19} strokeWidth={isActive("/account") ? 2 : 1.5} />
          <span>{t.header.account.replace(/^Mon |^My /, "")}</span>
        </Link>
      </div>
    </nav>
  );
}

/* ---------------------------------------------------------- Mobile menu */

function MobileMenu({
  open,
  onClose,
  categories,
  collections,
  brandName,
  supportPhone,
}: {
  open: boolean;
  onClose: () => void;
  categories: NavCategory[];
  collections: Array<{ name: string; slug: string }>;
  brandName: string;
  supportPhone: string;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedCollections, setExpandedCollections] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  useDialogFocus(open, panelRef, onClose);

  if (!open) return null;

  const stagger = (index: number) => ({ animationDelay: `${60 + index * 45}ms` });
  const itemClass =
    "animate-menu-item flex items-center justify-between border-b hairline py-[1.1rem] text-[0.8125rem] font-medium uppercase tracking-[0.18em]";

  return (
    <div
      className="fixed inset-0 z-[60] lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t.header.mobileMenu}
    >
      <button
        aria-label={t.header.closeMenu}
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-ink/55 backdrop-blur-[2px]"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="absolute left-0 top-0 flex h-full w-[86%] max-w-sm animate-slide-in-left flex-col bg-ivory shadow-drawer"
      >
        <div className="flex items-center justify-between border-b hairline px-6 pb-5 pt-6">
          <div>
            <p className="font-display text-[1.35rem] leading-none tracking-[0.3em]">{brandName}</p>
            <p className="mt-1.5 text-[0.625rem] uppercase tracking-[0.28em] text-ink-muted">
              {t.common.currencyNote} · 58 wilayas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.header.closeMenu}
            className="flex h-10 w-10 items-center justify-center rounded-full border hairline"
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label={t.header.mobileNav} className="flex-1 overflow-y-auto px-6 pb-4">
          <Link href="/shop" onClick={onClose} className={itemClass} style={stagger(0)}>
            {t.header.shop}
            <ChevronRight size={15} className="text-ink-muted" />
          </Link>
          <Link
            href="/collections/new-in"
            onClick={onClose}
            className={itemClass}
            style={stagger(1)}
          >
            {t.header.newIn}
            <ChevronRight size={15} className="text-ink-muted" />
          </Link>
          {categories.map((category, index) => (
            <div
              key={category.slug}
              className="animate-menu-item border-b hairline"
              style={stagger(index + 2)}
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/categories/${category.slug}`}
                  onClick={onClose}
                  className="flex-1 py-[1.1rem] text-[0.8125rem] font-medium uppercase tracking-[0.18em]"
                >
                  {category.name}
                </Link>
                {category.children.length > 0 ? (
                  <button
                    type="button"
                    aria-expanded={expanded === category.slug}
                    aria-label={`${t.header.categories} : ${category.name}`}
                    onClick={() => setExpanded(expanded === category.slug ? null : category.slug)}
                    className="flex h-10 w-10 items-center justify-center"
                  >
                    <ChevronDown
                      size={15}
                      className={cn(
                        "text-ink-muted transition-transform duration-300",
                        expanded === category.slug && "rotate-180",
                      )}
                    />
                  </button>
                ) : (
                  <ChevronRight size={15} className="text-ink-muted" />
                )}
              </div>
              {expanded === category.slug && (
                <div className="flex animate-fade-in flex-col pb-4">
                  {category.children.map((child) => (
                    <Link
                      key={child.slug}
                      href={`/categories/${child.slug}`}
                      onClick={onClose}
                      className="flex items-center justify-between py-2.5 pl-1 text-[0.9375rem] text-ink-soft"
                    >
                      {child.name}
                      <ChevronRight size={13} className="text-line" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div
            className="animate-menu-item border-b hairline"
            style={stagger(categories.length + 2)}
          >
            <div className="flex items-center justify-between">
              <Link
                href="/collections"
                onClick={onClose}
                className="flex-1 py-[1.1rem] text-[0.8125rem] font-medium uppercase tracking-[0.18em]"
              >
                {t.header.collections}
              </Link>
              <button
                type="button"
                aria-expanded={expandedCollections}
                aria-label={`${t.header.collections}`}
                onClick={() => setExpandedCollections(!expandedCollections)}
                className="flex h-10 w-10 items-center justify-center"
              >
                <ChevronDown
                  size={15}
                  className={cn(
                    "text-ink-muted transition-transform duration-300",
                    expandedCollections && "rotate-180",
                  )}
                />
              </button>
            </div>
            {expandedCollections && (
              <div className="flex animate-fade-in flex-col pb-4">
                {collections.map((collection) => (
                  <Link
                    key={collection.slug}
                    href={`/collections/${collection.slug}`}
                    onClick={onClose}
                    className="py-2.5 pl-1 text-[0.9375rem] text-ink-soft"
                  >
                    {collection.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link
            href="/collections/sale"
            onClick={onClose}
            className={itemClass}
            style={stagger(categories.length + 3)}
          >
            <span className="text-sale">{t.header.sale}</span>
            <ChevronRight size={15} className="text-sale/60" />
          </Link>

          <div className="mb-1 mt-6 flex items-center justify-between">
            <p className="text-[0.625rem] uppercase tracking-[0.28em] text-ink-muted">
              {t.header.mySpace}
            </p>
            <LocaleToggle />
          </div>
          {[
            { href: "/account", label: t.header.account, Icon: User },
            { href: "/wishlist", label: t.header.wishlist, Icon: Heart },
            { href: "/track", label: t.header.trackOrder, Icon: PackageSearch },
          ].map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onClose}
              className="flex items-center gap-3 border-b hairline py-3.5 text-sm"
            >
              <entry.Icon size={17} strokeWidth={1.5} className="text-ink-soft" />
              {entry.label}
            </Link>
          ))}
        </nav>
        {supportPhone && (
          <div className="border-t hairline bg-cream/60 px-6 py-4">
            <p className="text-[0.625rem] uppercase tracking-[0.24em] text-ink-muted">
              {t.header.needHelp}
            </p>
            <a
              href={`tel:${supportPhone.replace(/\s/g, "")}`}
              className="mt-1 block text-sm font-medium"
            >
              {supportPhone}
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------- Search overlay */

function SearchOverlay({
  open,
  onClose,
  popularSearches,
}: {
  open: boolean;
  onClose: () => void;
  popularSearches: string[];
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useDialogFocus(open, panelRef, onClose, searchInputRef);

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label={t.header.search}
    >
      <button
        aria-label={t.header.closeSearch}
        onClick={onClose}
        className="absolute inset-0 bg-ink/50"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-x-0 top-0 border-b hairline bg-gradient-to-b from-white to-cream px-4 py-4 md:px-8 md:py-5"
      >
        <div className="mx-auto max-w-xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[0.625rem] font-medium uppercase tracking-[0.24em] text-ink-muted">
              {t.header.searchLabel}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.header.closeSearch}
              className="p-1 text-ink-muted hover:text-ink"
            >
              <X size={17} />
            </button>
          </div>
          <form onSubmit={submit} role="search">
            <div className="flex items-center gap-2.5 border-b hairline pb-1.5 transition-colors focus-within:border-ink">
              <Search size={15} className="shrink-0 text-ink-muted" aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.header.searchPlaceholder}
                aria-label={t.header.searchProducts}
                className="w-full bg-transparent text-sm tracking-wide text-ink outline-none placeholder:text-ink-muted/70"
              />
              <button
                type="submit"
                className="shrink-0 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ink-muted underline underline-offset-4 hover:text-ink"
              >
                {t.header.ok}
              </button>
            </div>
          </form>
          {popularSearches.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[0.625rem] uppercase tracking-[0.18em] text-ink-muted">
                {t.header.popular}
              </p>
              {popularSearches.map((term) => (
                <Link
                  key={term}
                  href={`/search?q=${encodeURIComponent(term)}`}
                  onClick={onClose}
                  className="text-[13px] text-ink-soft underline decoration-line underline-offset-4 hover:text-ink"
                >
                  {term}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Footer */

function NewsletterMini() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await subscribeNewsletterAction(email, "footer", website);
      setState({ ok: result.ok, message: result.ok ? result.message : result.error });
      if (result.ok) setEmail("");
    } catch {
      setState({ ok: false, message: t.newsletter.subscribeFailed });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="relative mt-0">
      <Honeypot value={website} onChange={setWebsite} />
      <label htmlFor="footer-newsletter" className="sr-only">
        {t.footer.emailLabel}
      </label>
      <div className="flex items-center gap-3 border-b hairline pb-2 transition-colors focus-within:border-ink">
        <input
          id="footer-newsletter"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t.footer.emailPlaceholder}
          className="w-full bg-transparent text-[13px] tracking-wide text-ink outline-none placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-ink underline underline-offset-8 hover:text-gold-dark disabled:opacity-50"
        >
          OK
        </button>
      </div>
      {state && (
        <p className={`mt-2 text-sm ${state.ok ? "text-ink-soft" : "text-sale"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

function SiteFooter(props: ChromeProps) {
  const { t } = useLocale();
  const year = new Date().getFullYear();
  const socialLinks = [
    { label: "Instagram", href: props.social.instagram },
    { label: "TikTok", href: props.social.tiktok },
    { label: "Facebook", href: props.social.facebook },
  ].filter(({ href }) => /^https:\/\/[^/]+\/.+/.test(href));
  const whatsappHref = props.social.whatsapp
    ? `https://wa.me/${props.social.whatsapp.replace(/\D/g, "")}`
    : null;
  return (
    <footer className="site-footer mt-3 border-t hairline bg-chrome">
      <div className="container-luxe flex items-center justify-between gap-3 py-4 text-left md:block md:py-8 md:text-center">
        <div className="min-w-0">
          <p className="font-display text-lg tracking-[0.28em] md:text-xl">{props.brandName}</p>
          <p className="mt-1 max-w-[10rem] text-[0.65rem] leading-relaxed text-ink-soft md:mx-auto md:mt-2 md:max-w-xs md:text-xs">
            {t.footer.tagline}
          </p>
        </div>
        {(socialLinks.length > 0 || whatsappHref) && (
          <div className="flex max-w-[9rem] flex-wrap justify-end gap-x-3 gap-y-1 text-right text-[0.55rem] uppercase tracking-[0.14em] md:mx-auto md:mt-4 md:max-w-none md:justify-center md:gap-x-5 md:gap-y-2 md:text-[0.625rem] md:tracking-[0.18em]">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-ink"
              >
                {social.label}
              </a>
            ))}
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-ink"
              >
                WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
      <div className="border-t hairline">
        <div className="container-luxe grid min-w-0 grid-cols-3 gap-3 py-4 text-left md:gap-6 md:py-6">
          <nav aria-label={t.footer.shop}>
            <p className="mb-2 text-[0.55rem] font-medium uppercase tracking-[0.14em] text-ink-muted md:mb-3 md:text-[0.6rem] md:tracking-[0.2em]">
              {t.footer.shop}
            </p>
            <ul className="space-y-1.5 text-[0.68rem] leading-tight md:space-y-2 md:text-xs">
              <li>
                <Link href="/shop" className="text-ink-soft hover:text-ink">
                  {t.footer.shopAll}
                </Link>
              </li>
              <li>
                <Link href="/collections/new-in" className="text-ink-soft hover:text-ink">
                  {t.footer.newIn}
                </Link>
              </li>
              <li>
                <Link href="/collections/best-sellers" className="text-ink-soft hover:text-ink">
                  {t.footer.bestSellers}
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label={t.footer.help}>
            <p className="mb-2 text-[0.55rem] font-medium uppercase tracking-[0.14em] text-ink-muted md:mb-3 md:text-[0.6rem] md:tracking-[0.2em]">
              {t.footer.help}
            </p>
            <ul className="space-y-1.5 text-[0.68rem] leading-tight md:space-y-2 md:text-xs">
              <li>
                <Link href="/pages/shipping" className="text-ink-soft hover:text-ink">
                  {t.footer.shipping}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-ink-soft hover:text-ink">
                  {t.footer.faq}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-ink-soft hover:text-ink">
                  {t.footer.contactUs}
                </Link>
              </li>
            </ul>
          </nav>
          <div className="min-w-0">
            <p className="mb-2 text-[0.55rem] font-medium uppercase tracking-[0.14em] text-ink-muted md:mb-3 md:text-[0.6rem] md:tracking-[0.2em]">
              {t.footer.newsletter}
            </p>
            <NewsletterMini />
            {(props.supportEmail || props.supportPhone) && (
              <p className="mt-2 break-words text-[9px] leading-tight text-ink-muted md:mt-3 md:text-[11px] md:leading-relaxed">
                {props.supportEmail && (
                  <a href={`mailto:${props.supportEmail}`} className="hover:text-ink">
                    {props.supportEmail}
                  </a>
                )}
                {props.supportEmail && props.supportPhone && <span className="px-2">·</span>}
                {props.supportPhone && (
                  <a
                    href={`tel:${props.supportPhone.replace(/\s/g, "")}`}
                    className="hover:text-ink"
                  >
                    {props.supportPhone}
                  </a>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="border-t hairline">
        <div className="container-luxe flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 text-left text-[0.6rem] text-ink-muted md:text-[0.68rem]">
          <p>
            © {year} {props.brandName}
          </p>
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 md:gap-x-5">
            <Link href="/pages/privacy-policy" className="hover:text-ink">
              {t.footer.privacy}
            </Link>
            <Link href="/pages/terms" className="hover:text-ink">
              {t.footer.terms}
            </Link>
            <button type="button" onClick={openCookieSettings} className="hover:text-ink">
              {t.footer.cookies}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
