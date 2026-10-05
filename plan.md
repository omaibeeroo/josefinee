# Josefinee Silver-White Storefront Overhaul

## Design direction

- **Design movement:** Modern Shopify editorial commerce: Swiss-minimal structure softened by gallery-like product merchandising and subtle luxury motion.
- **Core principles:** generous whitespace, product-first hierarchy, quiet chrome, tactile micro-interactions, and progressive disclosure.
- **Color philosophy:** silver-white surfaces create a clean gallery feel; graphite anchors provide contrast; cool metallic blue-gray replaces warm gold as the ownable accent.
- **Layout paradigm:** full-bleed editorial moments alternate with constrained product rails, horizontal scroll shelves, and asymmetric content blocks rather than a page of identical centered grids.
- **Signature elements:** thin silver rules, frosted sticky header, and metallic gradient hover sheen on product media and CTAs.
- **Interaction philosophy:** every interactive element should feel light and immediate—lift, sheen, underline, drawer slide, and focused states are used instead of heavy shadows or abrupt color swaps.
- **Animation:** page sections fade upward on entry; product media gently zooms and crossfades; buttons use a silver sweep; drawers and overlays use spring-like easing. `prefers-reduced-motion` disables non-essential movement.
- **Typography system:** Inter for utility/navigation and Cormorant Garamond for editorial headlines, with smaller uppercase labels and restrained tracking.
- **Brand essence:** modern Algerian accessories for women building a considered everyday wardrobe; **polished, calm, magnetic**.
- **Brand voice:** concise French copy with a confident, invitational tone. Example lines: “Les essentiels, en mieux.” and “Choisissez votre prochaine pièce signature.”
- **Wordmark concept:** preserve the settings-driven Josefinee wordmark, presented with wider tracking and a compact silver monogram treatment where no logo asset is configured.
- **Signature brand color:** cool metallic blue-gray `#8794a3`.

## Architecture

- Preserve all server-rendered data loading, Prisma pricing, inventory, checkout, authentication, and admin permission boundaries.
- Keep `SiteChrome`, `HomePage`, `ProductCard`, `ProductCarousel`, and catalog filters as reusable primitives; update their styling and composition rather than duplicating commerce logic.
- Centralize visual behavior in `globals.css` tokens/utilities so admin and storefront components remain compatible with settings-driven accent variables.
- Add no new client-side price or order logic; all redesign work is presentation-only.
