import type { DeliveryMethod, OrderStatus, RiskLevel, DiscountType } from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<
  OrderStatus,
  { label: string; customerLabel: string; tone: string }
> = {
  PENDING: { label: "Pending", customerLabel: "Order received", tone: "amber" },
  CONFIRMED: { label: "Confirmed", customerLabel: "Confirmed", tone: "blue" },
  PROCESSING: { label: "Processing", customerLabel: "Preparing your order", tone: "blue" },
  PACKED: { label: "Packed", customerLabel: "Packaged", tone: "indigo" },
  SHIPPED: { label: "Shipped", customerLabel: "Shipped", tone: "indigo" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", customerLabel: "Out for delivery", tone: "violet" },
  DELIVERED: { label: "Delivered", customerLabel: "Delivered", tone: "green" },
  CANCELLED: { label: "Cancelled", customerLabel: "Cancelled", tone: "red" },
  RETURNED: { label: "Returned", customerLabel: "Returned", tone: "orange" },
  FAILED_DELIVERY: { label: "Failed delivery", customerLabel: "Delivery attempt failed", tone: "red" },
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

/** Statuses that count as a realised sale for analytics. */
export const REVENUE_STATUSES: OrderStatus[] = ["DELIVERED"];
export const OPEN_ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
];
export const CLOSED_ORDER_STATUSES: OrderStatus[] = ["DELIVERED", "CANCELLED", "RETURNED", "FAILED_DELIVERY"];

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  HOME: "Livraison à domicile",
  STOPDESK: "Point de retrait",
  EXPRESS: "Livraison express",
  STANDARD: "Livraison standard",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Low risk",
  MEDIUM: "Medium risk",
  HIGH: "High risk",
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: "Percentage",
  FIXED: "Fixed amount",
};

export const PRODUCT_SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "best-selling", label: "Best selling" },
] as const;

export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number]["value"];

export const PAGE_SIZE = 12;
export const ADMIN_PAGE_SIZE = 20;
export const PRODUCT_CARD_MAX_QUANTITY = 10;

export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const UPLOAD_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
