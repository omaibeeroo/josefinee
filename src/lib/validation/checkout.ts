import { z } from "zod";
import { zEmail, zHoneypot, zId, zOptionalString, zPhone } from "./common";

/**
 * Strict boolean: accepts real booleans (JSON actions) and "true"/"false"
 * strings (FormData). Unlike z.coerce.boolean(), the string "false" maps to
 * false instead of true.
 */
export const zStrictBoolean = z.union([
  z.boolean(),
  z.enum(["true", "false"]).transform((value) => value === "true"),
]);

export const checkoutSchema = z.object({
  firstName: z.string().trim().min(2, "Please enter your first name.").max(60),
  lastName: z.string().trim().min(2, "Please enter your last name.").max(60),
  phone: zPhone,
  email: z.preprocess((value) => (value === "" ? undefined : value), zEmail.optional()),
  wilayaId: zId,
  communeId: zId,
  address: z.string().trim().min(5, "Please enter your delivery address.").max(300),
  deliveryMethod: z.enum(["HOME", "STOPDESK", "EXPRESS", "STANDARD"]),
  notes: zOptionalString(500),
  couponCode: zOptionalString(40),
  createAccount: zStrictBoolean.optional().default(false),
  password: z.string().min(10, "Minimum 10 characters.").max(200).optional(),
  acceptTerms: zStrictBoolean.refine((value) => value === true, {
    message: "Please accept the terms and conditions.",
  }),
  allowDuplicate: zStrictBoolean.optional().default(false),
  idempotencyKey: z.string().trim().min(8).max(100),
  website: zHoneypot,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  phone: zPhone,
});
