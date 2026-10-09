import type { OrderStatus } from "@prisma/client";

/**
 * Status badge tones (presentation only). Human labels live in the i18n
 * dictionaries (`t.status` for staff, `t.customerStatus` for customers).
 */
export const ORDER_STATUS_TONES: Record<OrderStatus, { tone: string }> = {
  PENDING: { tone: "amber" },
  CONFIRMED: { tone: "blue" },
  PROCESSING: { tone: "blue" },
  PACKED: { tone: "indigo" },
  SHIPPED: { tone: "indigo" },
  OUT_FOR_DELIVERY: { tone: "violet" },
  DELIVERED: { tone: "green" },
  CANCELLED: { tone: "red" },
  RETURNED: { tone: "orange" },
  FAILED_DELIVERY: { tone: "red" },
};

/** The happy-path sequence shown to customers on the order timeline. */
export const CUSTOMER_ORDER_FLOW: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export const PRODUCT_SORT_OPTIONS = [
  "featured",
  "newest",
  "price-asc",
  "price-desc",
  "best-selling",
] as const;

export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number];

export const PAGE_SIZE = 12;

export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const UPLOAD_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
