import type { OrderStatus } from "@prisma/client";

/** Legal status transitions. Cancellations/returns restore stock. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "FAILED_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED_DELIVERY", "CANCELLED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
  FAILED_DELIVERY: ["SHIPPED", "CANCELLED"],
};

export function allowedNextStatuses(status: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

export type OrderFilters = {
  status?: string;
  wilayaId?: string;
  search?: string;
  risk?: string;
  from?: string;
  to?: string;
  page?: number;
};
