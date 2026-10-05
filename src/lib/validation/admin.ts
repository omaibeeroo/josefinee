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
export const productListParams = z.object({
  search: adminSearch,
  status: productStatus.optional(),
  page: adminPage,
});
export const inventoryListParams = z.object({
  search: adminSearch,
  lowOnly: z.boolean().default(false),
  page: adminPage,
});
export const auditListParams = z.object({
  action: z.string().trim().max(100).optional(),
  search: adminSearch,
  page: adminPage,
});
export const deliveryCsv = z.string().max(1_000_000);
export const customerNotes = z.string().max(2_000);
export const settingsKey = z.enum([
  "general",
  "homepage",
  "commerce",
  "seo",
  "social",
  "analytics",
  "notifications",
]);
export const settingsValue = z.record(z.string(), z.unknown());
export const orderFilters = z.object({
  status: orderStatus.optional(),
  wilayaId: adminId.optional(),
  risk: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  search: adminSearch,
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: adminPage,
});
