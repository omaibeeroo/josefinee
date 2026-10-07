import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale, type Locale } from "./locales";
import dictionaries from "./index";
import type { Dictionary } from "./provider";

export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return parseLocale(store.get(LOCALE_COOKIE)?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}

/** Locale-aware strings for server actions (user-facing toasts/errors). */
export async function getActionT(): Promise<
  Dictionary["actions"] & Dictionary["actionErrors"] & Dictionary["orderErrors"]
> {
  const dictionary = await getDictionary();
  return { ...dictionary.actions, ...dictionary.actionErrors, ...dictionary.orderErrors };
}
