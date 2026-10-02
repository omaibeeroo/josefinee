/**
 * RBAC definitions — shared between seeding and runtime authorization.
 * Kept free of server-only imports so the seed script can reuse it.
 */

export const PERMISSIONS = {
  DASHBOARD_READ: "dashboard:read",
  ANALYTICS_READ: "analytics:read",

  ORDERS_READ: "orders:read",
  ORDERS_WRITE: "orders:write",
  ORDERS_DELETE: "orders:delete",
  ORDERS_EXPORT: "orders:export",

  PRODUCTS_READ: "products:read",
  PRODUCTS_WRITE: "products:write",
  PRODUCTS_DELETE: "products:delete",

  INVENTORY_READ: "inventory:read",
  INVENTORY_WRITE: "inventory:write",

  CATALOG_WRITE: "catalog:write", // categories + collections

  COUPONS_READ: "coupons:read",
  COUPONS_WRITE: "coupons:write",
  PROMOTIONS_READ: "promotions:read",
  PROMOTIONS_WRITE: "promotions:write",

  CUSTOMERS_READ: "customers:read",
  CUSTOMERS_WRITE: "customers:write",

  REVIEWS_MODERATE: "reviews:moderate",
  CONTENT_WRITE: "content:write",
  MESSAGES_READ: "messages:read",
  MESSAGES_WRITE: "messages:write",
  NEWSLETTER_READ: "newsletter:read",
  NEWSLETTER_WRITE: "newsletter:write",
  NEWSLETTER_EXPORT: "newsletter:export",

  DELIVERY_READ: "delivery:read",
  DELIVERY_WRITE: "delivery:write",

  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",

  USERS_MANAGE: "users:manage",
  AUDIT_READ: "audit:read",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

export const ROLE_NAMES = [
  "SUPER_ADMIN",
  "ADMIN",
  "ORDER_MANAGER",
  "PRODUCT_MANAGER",
  "CUSTOMER_SUPPORT",
  "ANALYST",
] as const;

export type RoleNameValue = (typeof ROLE_NAMES)[number];

export const ROLES: Array<{ name: RoleNameValue; label: string; description: string }> = [
  {
    name: "SUPER_ADMIN",
    label: "Super Admin",
    description: "Full access, including user management.",
  },
  { name: "ADMIN", label: "Admin", description: "Everything except managing staff accounts." },
  { name: "ORDER_MANAGER", label: "Order Manager", description: "Orders, customers and delivery." },
  {
    name: "PRODUCT_MANAGER",
    label: "Product Manager",
    description: "Catalog, inventory and marketing.",
  },
  {
    name: "CUSTOMER_SUPPORT",
    label: "Customer Support",
    description: "Orders, reviews and messages.",
  },
  { name: "ANALYST", label: "Analyst", description: "Read-only access to reports." },
];

const P = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<RoleNameValue, PermissionCode[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter((code) => code !== P.USERS_MANAGE),
  ORDER_MANAGER: [
    P.DASHBOARD_READ,
    P.ANALYTICS_READ,
    P.ORDERS_READ,
    P.ORDERS_WRITE,
    P.ORDERS_EXPORT,
    P.INVENTORY_READ,
    P.CUSTOMERS_READ,
    P.DELIVERY_READ,
  ],
  PRODUCT_MANAGER: [
    P.DASHBOARD_READ,
    P.ANALYTICS_READ,
    P.PRODUCTS_READ,
    P.PRODUCTS_WRITE,
    P.PRODUCTS_DELETE,
    P.INVENTORY_READ,
    P.INVENTORY_WRITE,
    P.CATALOG_WRITE,
    P.COUPONS_READ,
    P.COUPONS_WRITE,
    P.PROMOTIONS_READ,
    P.PROMOTIONS_WRITE,
    P.REVIEWS_MODERATE,
    P.CONTENT_WRITE,
    P.DELIVERY_READ,
  ],
  CUSTOMER_SUPPORT: [
    P.DASHBOARD_READ,
    P.ORDERS_READ,
    P.ORDERS_WRITE,
    P.CUSTOMERS_READ,
    P.REVIEWS_MODERATE,
    P.MESSAGES_READ,
    P.MESSAGES_WRITE,
    P.NEWSLETTER_READ,
    P.CONTENT_WRITE,
  ],
  ANALYST: [
    P.DASHBOARD_READ,
    P.ANALYTICS_READ,
    P.ORDERS_READ,
    P.PRODUCTS_READ,
    P.INVENTORY_READ,
    P.CUSTOMERS_READ,
  ],
};
