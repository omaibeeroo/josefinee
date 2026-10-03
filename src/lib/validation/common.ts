import { z } from "zod";
import { normalizeAlgerianPhone, phoneError } from "@/lib/phone";

export const zEmail = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Please enter a valid email address.")
  .max(200)
  .transform((value) => value.toLowerCase());

export const zPhone = z
  .string()
  .trim()
  .min(1, "Phone number is required.")
  .transform((value) => normalizeAlgerianPhone(value))
  .refine((value): value is string => value !== null, { message: phoneError });

export const zId = z.string().trim().min(1, "Required.").max(64);

/**
 * Honeypot anti-spam field. Rendered off-screen; humans never fill it.
 * Any value means a bot — the action must silently discard the submission.
 */
export const zHoneypot = z.string().max(200).optional().default("");

export function isBotSubmission(website: string | undefined): boolean {
  return Boolean(website && website.trim().length > 0);
}
export const zSlug = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.");

export const zOptionalString = (max = 300) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const zInt = z.coerce.number().int();
export const zPrice = z.coerce.number().int().min(0).max(100_000_000);

export function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
