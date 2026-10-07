"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { setThemeAction } from "@/server/actions/theme";
import { useLocale } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { t, theme } = useLocale();
  const [activeTheme, setActiveTheme] = useState(theme);
  const dark = activeTheme === "dark";

  function toggle() {
    const nextTheme = dark ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    setActiveTheme(nextTheme);

    // The CSS variable swap is synchronous. Persist in the background so the
    // visible theme never waits for a server round-trip or root-layout refresh.
    window.setTimeout(() => root.classList.remove("theme-switching"), 120);
    void setThemeAction(nextTheme).catch(() => {
      root.dataset.theme = activeTheme;
      root.style.colorScheme = activeTheme;
      setActiveTheme(activeTheme);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.theme.toggle}
      aria-pressed={dark}
      title={t.theme.toggle}
      className={cn("icon-button p-2.5 hover:text-gold-dark", className)}
    >
      {dark ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
    </button>
  );
}
