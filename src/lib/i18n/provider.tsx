"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Locale } from "./locales";
import type { Theme } from "./theme";
import type { FrDictionary } from "./fr";
import dictionaries from "./index";

export type Dictionary = FrDictionary;

type LocaleContextValue = {
  locale: Locale;
  t: Dictionary;
  theme: Theme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale: serverLocale,
  dictionary: serverDictionary,
  theme: serverTheme,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  theme: Theme;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState(serverLocale);
  const [theme, setTheme] = useState(serverTheme);

  useEffect(() => setLocale(serverLocale), [serverLocale]);
  useEffect(() => setTheme(serverTheme), [serverTheme]);

  const dictionary = locale === serverLocale ? serverDictionary : dictionaries[locale];

  return (
    <LocaleContext.Provider value={{ locale, t: dictionary, theme, setLocale, setTheme }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
