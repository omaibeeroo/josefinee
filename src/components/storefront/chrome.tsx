"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Heart, Menu, PackageSearch, Search, ShoppingBag, User, X } from "lucide-react";
import { useCart } from "@/components/storefront/cart-ui";
import { subscribeNewsletterAction } from "@/server/actions/engagement";
import { Honeypot } from "@/components/ui";
import { openCookieSettings } from "@/components/cookie-consent";
import { cn } from "@/lib/utils";

export type NavCategory = {
  name: string;
  slug: string;
  children: Array<{ name: string; slug: string }>;
};

export type ChromeProps = {
  brandName: string;
  tagline: string;
  logoUrl: string;
  announcement: { text: string; href: string } | null;
  categories: NavCategory[];
  collections: Array<{ name: string; slug: string }>;
  social: { instagram: string; tiktok: string; facebook: string; whatsapp: string };
  supportEmail: string;
  supportPhone: string;
  popularSearches: string[];
};

function BrandMark({ brandName, logoUrl, onClick }: { brandName: string; logoUrl: string; onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="inline-flex items-center gap-2" aria-label={`${brandName} home`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={brandName} width={120} height={36} className="h-9 w-auto" />
      ) : (
        <span className="font-display text-[1.7rem] font-medium tracking-[0.32em]">{brandName}</span>
      )}
    </Link>
  );
}

function DesktopDropdown({ label, href, children }: { label: string; href: string; children: ReactNode }) {
  return (
    <div className="group relative">
      <Link
        href={href}
        className="flex items-center gap-1 py-5 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-ink transition-colors hover:text-gold-dark"
      >
        {label}
        <ChevronDown size={12} className="transition-transform group-hover:rotate-180" />
      </Link>
      <div className="invisible absolute left-1/2 top-full z-50 w-60 -translate-x-1/2 translate-y-1 border hairline bg-white opacity-0 shadow-card transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="flex flex-col p-2">{children}</div>
      </div>
    </div>
  );
}

function DropdownLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-cream hover:text-ink"
    >
      {children}
    </Link>
  );
}

export function SiteChrome(props: ChromeProps & { children: ReactNode }) {
  const { brandName, announcement, children } = props;
  const { count, setOpen } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

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

  const jewelry = props.categories.find((c) => c.slug === "jewelry");
  const bags = props.categories.find((c) => c.slug === "bags-wallets");
  const accessories = props.categories.find((c) => c.slug === "accessories");
  const clothes = props.categories.find((c) => c.slug === "clothes");

  return (
    <>
      {announcement && (
        <div className="bg-ink text-ivory">
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
          "sticky top-0 z-50 border-b bg-ivory/95 backdrop-blur transition-shadow",
          scrolled ? "hairline shadow-[0_8px_30px_-18px_rgba(28,26,23,0.4)]" : "border-transparent",
        )}
      >
        {/* Desktop */}
        <div className="container-luxe hidden items-center justify-between gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <BrandMark brandName={brandName} logoUrl={props.logoUrl} />
          <nav aria-label="Primary" className="flex items-center gap-7">
            <Link className="py-5 text-[0.72rem] font-medium uppercase tracking-[0.18em] hover:text-gold-dark" href="/shop">
              Shop all
            </Link>
            {jewelry && (
              <DesktopDropdown label={jewelry.name} href={`/categories/${jewelry.slug}`}>
                {jewelry.children.map((child) => (
                  <DropdownLink key={child.slug} href={`/categories/${child.slug}`}>
                    {child.name}
                  </DropdownLink>
                ))}
                <DropdownLink href="/collections/jewelry">View all jewelry</DropdownLink>
              </DesktopDropdown>
            )}
            {bags && (
              <DesktopDropdown label={bags.name} href={`/categories/${bags.slug}`}>
                {bags.children.map((child) => (
                  <DropdownLink key={child.slug} href={`/categories/${child.slug}`}>
                    {child.name}
                  </DropdownLink>
                ))}
              </DesktopDropdown>
            )}
            {accessories && (
              <DesktopDropdown label={accessories.name} href={`/categories/${accessories.slug}`}>
                {accessories.children.map((child) => (
                  <DropdownLink key={child.slug} href={`/categories/${child.slug}`}>
                    {child.name}
                  </DropdownLink>
                ))}
              </DesktopDropdown>
            )}
            {clothes && (
              <Link className="py-5 text-[0.72rem] font-medium uppercase tracking-[0.18em] hover:text-gold-dark" href={`/categories/${clothes.slug}`}>
                {clothes.name}
              </Link>
            )}
            <DesktopDropdown label="Collections" href="/collections">
              {props.collections.map((collection) => (
                <DropdownLink key={collection.slug} href={`/collections/${collection.slug}`}>
                  {collection.name}
                </DropdownLink>
              ))}
            </DesktopDropdown>
            <Link
              href="/collections/sale"
              className="py-5 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-sale"
            >
              Sale
            </Link>
          </nav>
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search" className="p-2.5 hover:text-gold-dark">
              <Search size={19} strokeWidth={1.75} />
            </button>
            <Link href="/account" aria-label="Account" className="p-2.5 hover:text-gold-dark">
              <User size={19} strokeWidth={1.75} />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Open bag, ${count} items`}
              className="relative p-2.5 hover:text-gold-dark"
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

        {/* Mobile */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 py-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="p-3"
          >
            <Menu size={22} strokeWidth={1.75} />
          </button>
          <div className="flex justify-center">
            <BrandMark brandName={brandName} logoUrl={props.logoUrl} />
          </div>
          <div className="flex items-center">
            <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search" className="p-2.5">
              <Search size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Open bag, ${count} items`}
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
      <main>{children}</main>
      <SiteFooter {...props} />
    </>
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedCollections, setExpandedCollections] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const stagger = (index: number) => ({ animationDelay: `${60 + index * 45}ms` });
  const itemClass =
    "animate-menu-item flex items-center justify-between border-b hairline py-[1.1rem] text-[0.8125rem] font-medium uppercase tracking-[0.18em]";

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button aria-label="Close menu" onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink/55 backdrop-blur-[2px]" />
      <aside className="absolute left-0 top-0 flex h-full w-[86%] max-w-sm animate-slide-in-left flex-col bg-ivory shadow-drawer">
        <div className="flex items-center justify-between border-b hairline px-6 pb-5 pt-6">
          <div>
            <p className="font-display text-[1.35rem] leading-none tracking-[0.3em]">{brandName}</p>
            <p className="mt-1.5 text-[0.625rem] uppercase tracking-[0.28em] text-ink-muted">
              Cash on delivery · 58 wilayas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-full border hairline"
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-6 pb-4">
          <Link href="/shop" onClick={onClose} className={itemClass} style={stagger(0)}>
            Shop all
            <ChevronRight size={15} className="text-ink-muted" />
          </Link>
          {categories.map((category, index) => (
            <div key={category.slug} className="animate-menu-item border-b hairline" style={stagger(index + 1)}>
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
                    aria-label={`Expand ${category.name}`}
                    onClick={() => setExpanded(expanded === category.slug ? null : category.slug)}
                    className="flex h-10 w-10 items-center justify-center"
                  >
                    <ChevronDown
                      size={15}
                      className={cn("text-ink-muted transition-transform duration-300", expanded === category.slug && "rotate-180")}
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
          <div className="animate-menu-item border-b hairline" style={stagger(categories.length + 1)}>
            <div className="flex items-center justify-between">
              <Link href="/collections" onClick={onClose} className="flex-1 py-[1.1rem] text-[0.8125rem] font-medium uppercase tracking-[0.18em]">
                Collections
              </Link>
              <button
                type="button"
                aria-expanded={expandedCollections}
                aria-label="Expand collections"
                onClick={() => setExpandedCollections(!expandedCollections)}
                className="flex h-10 w-10 items-center justify-center"
              >
                <ChevronDown size={15} className={cn("text-ink-muted transition-transform duration-300", expandedCollections && "rotate-180")} />
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
          <Link href="/collections/sale" onClick={onClose} className={itemClass} style={stagger(categories.length + 2)}>
            <span className="text-sale">Sale</span>
            <ChevronRight size={15} className="text-sale/60" />
          </Link>

          <p className="mb-1 mt-6 text-[0.625rem] uppercase tracking-[0.28em] text-ink-muted">Your space</p>
          {[
            { href: "/account", label: "Account", Icon: User },
            { href: "/wishlist", label: "Wishlist", Icon: Heart },
            { href: "/track", label: "Track order", Icon: PackageSearch },
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
        <div className="border-t hairline bg-cream/60 px-6 py-4">
          <p className="text-[0.625rem] uppercase tracking-[0.24em] text-ink-muted">Need help?</p>
          <p className="mt-1 text-sm font-medium">{supportPhone}</p>
        </div>
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
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Search">
      <button aria-label="Close search" onClick={onClose} className="absolute inset-0 bg-ink/50" />
      <div className="absolute inset-x-0 top-0 bg-ivory px-4 py-6 shadow-card animate-slide-up md:px-8 md:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 flex items-center justify-between">
            <p className="eyebrow">Search the store</p>
            <button type="button" onClick={onClose} aria-label="Close search" className="p-1">
              <X size={22} />
            </button>
          </div>
          <form onSubmit={submit} role="search">
            <div className="flex gap-2">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Necklace, tote, gold hoops…"
                aria-label="Search products"
                className="field"
              />
              <button type="submit" className="btn btn-primary shrink-0">
                <Search size={16} />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
          </form>
          {popularSearches.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-ink-muted">Popular</p>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    onClick={onClose}
                    className="border hairline bg-white px-3 py-1.5 text-sm text-ink-soft hover:border-ink hover:text-ink"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Footer */

function NewsletterMini() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await subscribeNewsletterAction(email, "footer", website);
    setState({ ok: result.ok, message: result.ok ? result.message : result.error });
    if (result.ok) setEmail("");
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="relative mt-4">
      <Honeypot value={website} onChange={setWebsite} />
      <label htmlFor="footer-newsletter" className="field-label !text-ivory/70">
        Newsletter
      </label>
      <div className="flex gap-2">
        <input
          id="footer-newsletter"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your email"
          className="field !border-white/20 !bg-transparent !text-ivory placeholder:text-ivory/40"
        />
        <button type="submit" disabled={pending} className="btn btn-gold shrink-0">
          Join
        </button>
      </div>
      {state && (
        <p className={`mt-2 text-sm ${state.ok ? "text-ivory/80" : "text-blush"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

function SiteFooter(props: ChromeProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 bg-ink text-ivory">
      <div className="container-luxe grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <p className="font-display text-2xl tracking-[0.3em]">{props.brandName}</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ivory/70">{props.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm uppercase tracking-[0.14em]">
            <a href={props.social.instagram} target="_blank" rel="noopener noreferrer" className="text-ivory/80 hover:text-ivory">
              Instagram
            </a>
            <a href={props.social.tiktok} target="_blank" rel="noopener noreferrer" className="text-ivory/80 hover:text-ivory">
              TikTok
            </a>
            <a href={props.social.facebook} target="_blank" rel="noopener noreferrer" className="text-ivory/80 hover:text-ivory">
              Facebook
            </a>
            {props.social.whatsapp && (
              <a
                href={`https://wa.me/${props.social.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ivory/80 hover:text-ivory"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
        <nav aria-label="Shop">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-ivory/60">Shop</p>
          <ul className="space-y-2.5 text-[0.9375rem]">
            <li><Link href="/shop" className="text-ivory/85 hover:text-ivory">Shop all</Link></li>
            {props.categories.slice(0, 4).map((category) => (
              <li key={category.slug}>
                <Link href={`/categories/${category.slug}`} className="text-ivory/85 hover:text-ivory">
                  {category.name}
                </Link>
              </li>
            ))}
            <li><Link href="/collections/new-in" className="text-ivory/85 hover:text-ivory">New in</Link></li>
          </ul>
        </nav>
        <nav aria-label="Customer care">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-ivory/60">Customer care</p>
          <ul className="space-y-2.5 text-[0.9375rem]">
            <li><Link href="/contact" className="text-ivory/85 hover:text-ivory">Contact</Link></li>
            <li><Link href="/pages/shipping" className="text-ivory/85 hover:text-ivory">Delivery</Link></li>
            <li><Link href="/track" className="text-ivory/85 hover:text-ivory">Track order</Link></li>
            <li><Link href="/faq" className="text-ivory/85 hover:text-ivory">FAQ</Link></li>
            <li><Link href="/pages/returns" className="text-ivory/85 hover:text-ivory">Returns</Link></li>
          </ul>
        </nav>
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-ivory/60">Stay in touch</p>
          <p className="text-sm text-ivory/70">
            {props.supportEmail}
            <br />
            {props.supportPhone}
          </p>
          <NewsletterMini />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-luxe flex flex-col items-center justify-between gap-3 py-5 text-xs text-ivory/60 md:flex-row">
          <p>© {year} {props.brandName}. All rights reserved.</p>
          <p className="uppercase tracking-[0.16em]">Cash on delivery · 58 wilayas</p>
          <div className="flex gap-4">
            <Link href="/pages/privacy-policy" className="hover:text-ivory">Privacy</Link>
            <Link href="/pages/terms" className="hover:text-ivory">Terms</Link>
            <button type="button" onClick={openCookieSettings} className="hover:text-ivory">
              Cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
