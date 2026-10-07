"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/i18n/theme";

export async function setThemeAction(value: string): Promise<{ ok: boolean }> {
  const theme = parseTheme(value);
  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86_400,
  });
  return { ok: true };
}
