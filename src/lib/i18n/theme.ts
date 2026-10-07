export const THEMES = ["light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "hanadi-theme";

export function parseTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : "light";
}
