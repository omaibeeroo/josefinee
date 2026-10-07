"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale } from "@/lib/i18n/locales";

export async function setLocaleAction(value: string): Promise<{ ok: boolean }> {
  const locale = parseLocale(value);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86_400,
  });
  return { ok: true };
}
