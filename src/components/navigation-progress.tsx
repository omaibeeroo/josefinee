"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Whisper-thin gold progress line for route transitions.
 * Appears on navigation and melts away — no spinners, no layout shift.
 */
function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "active" | "done">("idle");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPhase("active");
    const finish = setTimeout(() => setPhase("done"), 400);
    const hide = setTimeout(() => setPhase("idle"), 750);
    return () => {
      clearTimeout(finish);
      clearTimeout(hide);
    };
  }, [pathname, searchParams]);

  if (phase === "idle") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[2px]" aria-hidden="true">
      <div
        className={cn(
          "h-full bg-gold transition-all ease-out",
          phase === "active" ? "w-3/4 duration-500 opacity-100" : "w-full opacity-0 duration-300",
        )}
        style={{ boxShadow: "0 0 8px rgba(176,141,87,0.8)" }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}

/**
 * Route transition: replays a short motion-safe fade on every navigation.
 * Keep transforms off this outer wrapper: transformed ancestors change the
 * containing block for fixed storefront controls such as the app header.
 * Pure CSS, no libraries; `motion-safe:` keeps it off
 * for reduced-motion visitors. Remount is scoped to the template boundary so
 * layout-level state (cart, locale, theme) is preserved.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="motion-safe:animate-fade-in">
      {children}
    </div>
  );
}
