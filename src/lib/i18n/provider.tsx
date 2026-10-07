"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./locales";
import type { Theme } from "./theme";
import type { FrDictionary } from "./fr";

export type Dictionary = FrDictionary;

type LocaleContextValue = { locale: Locale; t: Dictionary; theme: Theme };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dictionary,
  theme,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  theme: Theme;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, t: dictionary, theme }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
