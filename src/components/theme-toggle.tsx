"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { setThemeAction } from "@/server/actions/theme";
import { useLocale } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { t, theme } = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const dark = theme === "dark";

  async function toggle() {
    if (pending) return;
    setPending(true);
    // Apply instantly for feedback; the server render confirms on refresh.
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    await setThemeAction(dark ? "light" : "dark").catch(() => undefined);
    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={pending}
      aria-label={t.theme.toggle}
      aria-pressed={dark}
      title={t.theme.toggle}
      className={cn("icon-button p-2.5 hover:text-gold-dark disabled:opacity-50", className)}
    >
      {dark ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
    </button>
  );
}
