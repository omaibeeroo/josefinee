import { z } from "zod";
import { zEmail, zHoneypot, zId, zOptionalString, zPhone } from "./common";
import { passwordIssues } from "@/lib/auth/password";

export const adminLoginSchema = z.object({
  email: zEmail,
  password: z.string().min(1, "Password is required.").max(200),
  totp: zOptionalString(10),
});

export const customerLoginSchema = z.object({
  email: zEmail,
  password: z.string().min(1, "Password is required.").max(200),
});

export const customerRegisterSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: zEmail,
  phone: zPhone,
  password: z
    .string()
    .min(10, "Minimum 10 characters.")
    .max(200)
    .refine((value) => passwordIssues(value).length === 0, {
      message: "Use upper and lower case letters and at least one number.",
    }),
});

export const newsletterSchema = z.object({
  email: zEmail,
  source: zOptionalString(60),
  website: zHoneypot,
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: zEmail,
  phone: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    zPhone.optional(),
  ),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(10, "Please write a longer message.").max(4000),
  website: zHoneypot,
});

export const reviewSchema = z.object({
  productId: zId,
  rating: z.coerce.number().int().min(1).max(5),
  title: zOptionalString(120),
  body: z.string().trim().min(5, "Please write a short review.").max(2000),
  authorName: z.string().trim().min(2).max(80),
  website: zHoneypot,
});
