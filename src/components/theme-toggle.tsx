"use client";

import { Moon, Sun } from "lucide-react";
import { setThemeAction } from "@/server/actions/theme";
import { useLocale } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

let latestThemeWrite = 0;

export function ThemeToggle({ className }: { className?: string }) {
  const { t, theme, setTheme } = useLocale();
  const dark = theme === "dark";

  function toggle() {
    const previousTheme = theme;
    const nextTheme = dark ? "light" : "dark";
    const writeId = ++latestThemeWrite;
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    setTheme(nextTheme);

    // The CSS variable swap is synchronous. Persist in the background so the
    // visible theme never waits for a server round-trip or root-layout refresh.
    window.setTimeout(() => root.classList.remove("theme-switching"), 120);
    void setThemeAction(nextTheme).catch(() => {
      if (writeId !== latestThemeWrite) return;
      root.classList.add("theme-switching");
      root.dataset.theme = previousTheme;
      root.style.colorScheme = previousTheme;
      setTheme(previousTheme);
      window.setTimeout(() => root.classList.remove("theme-switching"), 120);
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
