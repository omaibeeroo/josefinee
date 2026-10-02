export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
}

export function randomSuffix(length = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export function uniqueSlug(input: string, existing: string[]): string {
  const base = slugify(input) || `item-${randomSuffix()}`;
  if (!existing.includes(base)) return base;
  let attempt = `${base}-${randomSuffix()}`;
  while (existing.includes(attempt)) {
    attempt = `${base}-${randomSuffix()}`;
  }
  return attempt;
}
