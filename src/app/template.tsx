import { PageTransition } from "@/components/navigation-progress";

/**
 * Root route template: every navigation remounts the page (not the layout),
 * replaying the motion-safe page-enter transition. Layout-level providers
 * (cart, locale, theme) sit above and keep their state.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
