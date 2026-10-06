import type { DeliveryMethod, OrderStatus } from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<
  OrderStatus,
  { label: string; customerLabel: string; tone: string }
> = {
  PENDING: { label: "En attente", customerLabel: "Commande reçue", tone: "amber" },
  CONFIRMED: { label: "Confirmée", customerLabel: "Confirmée", tone: "blue" },
  PROCESSING: { label: "En préparation", customerLabel: "Préparation de votre commande", tone: "blue" },
  PACKED: { label: "Emballée", customerLabel: "Emballée", tone: "indigo" },
  SHIPPED: { label: "Expédiée", customerLabel: "Expédiée", tone: "indigo" },
  OUT_FOR_DELIVERY: { label: "En livraison", customerLabel: "En cours de livraison", tone: "violet" },
  DELIVERED: { label: "Livrée", customerLabel: "Livrée", tone: "green" },
  CANCELLED: { label: "Annulée", customerLabel: "Annulée", tone: "red" },
  RETURNED: { label: "Retournée", customerLabel: "Retournée", tone: "orange" },
  FAILED_DELIVERY: { label: "Livraison échouée", customerLabel: "Tentative de livraison échouée", tone: "red" },
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
