import type { DeliveryMethod, OrderStatus } from "@prisma/client";

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

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  HOME: "Livraison à domicile",
  STOPDESK: "Point de retrait",
  EXPRESS: "Livraison express",
  STANDARD: "Livraison standard",
};

export const PRODUCT_SORT_OPTIONS = [
  { value: "featured", label: "Notre sélection" },
  { value: "newest", label: "Nouveautés" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
  { value: "best-selling", label: "Meilleures ventes" },
] as const;

export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 12;

export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const UPLOAD_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
