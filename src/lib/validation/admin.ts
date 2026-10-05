import { z } from "zod";
import { zId } from "./common";

export const adminId = zId;
export const adminPage = z.coerce.number().int().min(1).max(500).default(1);
export const adminSearch = z.string().trim().max(100).optional();
export const userStatus = z.enum(["ACTIVE", "DISABLED"]);
export const customerStatus = z.enum(["ACTIVE", "BLOCKED"]);
export const productStatus = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export const reviewStatus = z.enum(["APPROVED", "REJECTED"]);
export const orderStatus = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "FAILED_DELIVERY",
]);
export const messageStatus = z.enum(["NEW", "IN_PROGRESS", "RESOLVED", "SPAM"]);
