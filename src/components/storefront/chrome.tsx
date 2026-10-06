"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Heart,
  Menu,
  PackageSearch,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useCart } from "@/components/storefront/cart-ui";
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
  tagline: string;
  logoUrl: string;
  announcement: { text: string; href: string } | null;
  categories: NavCategory[];
  collections: Array<{ name: string; slug: string }>;
  social: { instagram: string; tiktok: string; facebook: string; whatsapp: string };
  supportEmail: string;
  supportPhone: string;
  legalName: string;
  address: string;
  popularSearches: string[];
};

function BrandMark({
  brandName,
  logoUrl,
  onClick,
}: {
  brandName: string;
  logoUrl: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="inline-flex items-center gap-2 transition-transform duration-300 hover:scale-[1.02]"
      aria-label={`Accueil ${brandName}`}
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
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative shrink-0">
      <Link
        href={href}
        className="nav-link flex items-center gap-1 whitespace-nowrap py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:text-gold-dark"
      >
        {label}
        <ChevronDown size={12} className="transition-transform group-hover:rotate-180" />
      </Link>
      <div className="invisible absolute left-1/2 top-full z-50 max-h-[70vh] w-60 -translate-x-1/2 translate-y-1 overflow-y-auto overscroll-contain border hairline bg-white opacity-0 shadow-card transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 no-scrollbar">
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
          "sticky top-0 z-50 border-b bg-white/95 backdrop-blur transition-shadow",
          scrolled ? "hairline shadow-[0_8px_30px_-18px_rgba(28,26,23,0.4)]" : "border-transparent",
        )}
      >
        {/* Desktop */}
        <div className="container-luxe hidden lg:block">
          <div className="relative flex h-16 items-center justify-center">
            <BrandMark brandName={brandName} logoUrl={props.logoUrl} />
            <div className="absolute right-0 flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Rechercher"
                className="icon-button p-2.5 hover:text-gold-dark"
              >
                <Search size={19} strokeWidth={1.75} />
              </button>
              <Link
                href="/account"
                aria-label="Mon compte"
                className="icon-button p-2.5 hover:text-gold-dark"
              >
                <User size={19} strokeWidth={1.75} />
              </Link>
              <Link
                href="/wishlist"
                aria-label="Liste d’envies"
                className="icon-button p-2.5 hover:text-gold-dark"
              >
                <Heart size={19} strokeWidth={1.75} />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`Ouvrir le panier, ${count} article${count > 1 ? "s" : ""}`}
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
            aria-label="Navigation principale"
            className="flex flex-wrap items-center justify-center gap-x-3 border-t hairline px-2 py-1 xl:gap-x-6"
          >
            <Link
              className="nav-link whitespace-nowrap px-2 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] hover:text-gold-dark"
              href="/"
            >
              Accueil
            </Link>
            <Link
              className="nav-link whitespace-nowrap px-2 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] hover:text-gold-dark"
              href="/shop"
            >
              Boutique
            </Link>
            <DesktopDropdown label="Catégories" href="/shop">
              {props.categories.map((category) => (
                <div key={category.slug}>
                  <DropdownLink href={`/categories/${category.slug}`}>{category.name}</DropdownLink>
                  {category.children.map((child) => (
                    <DropdownLink key={child.slug} href={`/categories/${child.slug}`}>
                      <span className="pl-3 text-xs">{child.name}</span>
                    </DropdownLink>
                  ))}
                </div>
              ))}
            </DesktopDropdown>
            <DesktopDropdown label="Collections" href="/collections">
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
              Nouveautés
            </Link>
            <Link
              href="/collections/best-sellers"
              className="nav-link whitespace-nowrap px-2 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] hover:text-gold-dark"
            >
              Meilleures ventes
            </Link>
            <Link
              href="/collections/sale"
              className="whitespace-nowrap px-2 py-2.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-sale"
            >
              Promotions
            </Link>
          </nav>
        </div>

        {/* Mobile */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 py-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
            className="p-3"
          >
            <Menu size={22} strokeWidth={1.75} />
          </button>
          <div className="flex justify-center">
            <BrandMark brandName={brandName} logoUrl={props.logoUrl} />
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Rechercher"
              className="p-2.5"
            >
              <Search size={20} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Ouvrir le panier, ${count} article${count > 1 ? "s" : ""}`}
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
      <main key={pathname} className="page-enter">
        {children}
      </main>
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
      aria-label="Menu"
    >
      <button
        aria-label="Fermer le menu"
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
              Paiement à la livraison · 58 wilayas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="flex h-10 w-10 items-center justify-center rounded-full border hairline"
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Navigation mobile" className="flex-1 overflow-y-auto px-6 pb-4">
          <Link href="/shop" onClick={onClose} className={itemClass} style={stagger(0)}>
            Boutique
            <ChevronRight size={15} className="text-ink-muted" />
          </Link>
          <Link
            href="/collections/new-in"
            onClick={onClose}
            className={itemClass}
            style={stagger(1)}
          >
            Nouveautés
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
                    aria-label={`Afficher ${category.name}`}
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
                Collections
              </Link>
              <button
                type="button"
                aria-expanded={expandedCollections}
                aria-label="Afficher les collections"
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
            <span className="text-sale">Promotions</span>
            <ChevronRight size={15} className="text-sale/60" />
          </Link>

          <p className="mb-1 mt-6 text-[0.625rem] uppercase tracking-[0.28em] text-ink-muted">
            Mon espace
          </p>
          {[
            { href: "/account", label: "Mon compte", Icon: User },
            { href: "/wishlist", label: "Liste d’envies", Icon: Heart },
            { href: "/track", label: "Suivre ma commande", Icon: PackageSearch },
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
              Besoin d’aide ?
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
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Recherche">
      <button
        aria-label="Fermer la recherche"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-x-0 top-0 bg-ivory px-4 py-6 shadow-card animate-slide-up md:px-8 md:py-10"
      >
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 flex items-center justify-between">
            <p className="eyebrow">Rechercher dans la boutique</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la recherche"
              className="p-1"
            >
              <X size={22} />
            </button>
          </div>
          <form onSubmit={submit} role="search">
            <div className="flex gap-2">
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Collier, sac, boucles d’oreilles…"
                aria-label="Rechercher des produits"
                className="field"
              />
              <button type="submit" className="btn btn-primary shrink-0">
                <Search size={16} />
                <span className="hidden sm:inline">Rechercher</span>
              </button>
            </div>
          </form>
          {popularSearches.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-ink-muted">
                Recherches populaires
              </p>
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
    try {
      const result = await subscribeNewsletterAction(email, "footer", website);
      setState({ ok: result.ok, message: result.ok ? result.message : result.error });
      if (result.ok) setEmail("");
    } catch {
      setState({ ok: false, message: "Une erreur est survenue. Veuillez réessayer." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="relative mt-0">
      <Honeypot value={website} onChange={setWebsite} />
      <label htmlFor="footer-newsletter" className="sr-only">
        Newsletter
      </label>
      <div className="flex gap-2">
        <input
          id="footer-newsletter"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Votre adresse e-mail"
          className="field !border-white/20 !bg-transparent !text-ivory placeholder:text-ivory/40"
        />
        <button type="submit" disabled={pending} className="btn btn-gold shrink-0">
          S’inscrire
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
  const socialLinks = [
    { label: "Instagram", href: props.social.instagram },
    { label: "TikTok", href: props.social.tiktok },
    { label: "Facebook", href: props.social.facebook },
  ].filter(({ href }) => /^https:\/\/[^/]+\/.+/.test(href));
  return (
    <footer className="site-footer mt-16 bg-ink text-ivory">
      <div className="container-luxe grid gap-8 py-10 md:grid-cols-[1.25fr_0.8fr_1.35fr] md:gap-12 md:py-12">
        <div>
          <p className="font-display text-xl tracking-[0.3em]">{props.brandName}</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-ivory/65">
            Des pièces à porter encore et encore.
          </p>
          {socialLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[0.68rem] uppercase tracking-[0.16em]">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ivory/80 hover:text-ivory"
                >
                  {social.label}
                </a>
              ))}
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
          )}
        </div>
        <nav aria-label="Liens rapides">
          <p className="mb-3 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ivory/55">
            Explorer
          </p>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
            <li>
              <Link href="/shop" className="text-ivory/85 hover:text-ivory">
                Boutique
              </Link>
            </li>
            <li>
              <Link href="/collections/new-in" className="text-ivory/85 hover:text-ivory">
                Nouveautés
              </Link>
            </li>
            <li>
              <Link href="/collections/best-sellers" className="text-ivory/85 hover:text-ivory">
                Meilleures ventes
              </Link>
            </li>
            <li>
              <Link href="/pages/shipping" className="text-ivory/85 hover:text-ivory">
                Livraison
              </Link>
            </li>
            <li>
              <Link href="/faq" className="text-ivory/85 hover:text-ivory">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-ivory/85 hover:text-ivory">
                Contact
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="mb-3 text-[0.65rem] font-medium uppercase tracking-[0.2em] text-ivory/55">
            Recevez nos nouveautés
          </p>
          <NewsletterMini />
          {(props.supportEmail || props.supportPhone) && (
            <p className="mt-3 text-xs text-ivory/55">
              {props.supportEmail && (
                <a href={`mailto:${props.supportEmail}`} className="hover:text-ivory">
                  {props.supportEmail}
                </a>
              )}
              {props.supportEmail && props.supportPhone && <span className="px-2">·</span>}
              {props.supportPhone && (
                <a
                  href={`tel:${props.supportPhone.replace(/\s/g, "")}`}
                  className="hover:text-ivory"
                >
                  {props.supportPhone}
                </a>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-luxe flex flex-col gap-3 py-4 text-[0.68rem] text-ivory/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {props.brandName}
          </p>
          <div className="flex gap-4">
            <Link href="/pages/privacy-policy" className="hover:text-ivory">
              Confidentialité
            </Link>
            <Link href="/pages/terms" className="hover:text-ivory">
              Conditions
            </Link>
            <button type="button" onClick={openCookieSettings} className="hover:text-ivory">
              Cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
