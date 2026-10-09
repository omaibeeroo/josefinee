export class AppError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly status: number;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: string,
    userMessage: string,
    status = 400,
    meta?: Record<string, unknown>,
  ) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
    this.meta = meta;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Never leak stack traces or database errors to customers. */
export function toUserMessage(error: unknown): string {
  if (isAppError(error)) return error.userMessage;
  return "Something went wrong. Please try again.";
}

/**
 * Domain error codes carry English developer messages; the locale-correct
 * customer copy lives in the dictionaries. Map stable codes to dictionary
 * keys at the action boundary (where `t` is available) so toasts follow the
 * visitor locale. Unknown codes and non-app errors fall back to
 * {@link toUserMessage} — never a blank string.
 */
const ERROR_MESSAGE_KEYS: Record<string, string> = {
  INVALID_QUANTITY: "validQuantity",
  PRODUCT_UNAVAILABLE: "productGone",
  OUT_OF_STOCK: "outOfStock",
  CART_NOT_FOUND: "bagEmpty",
  CART_EMPTY: "bagEmpty",
  CART_ITEM_NOT_FOUND: "itemUnavailable",
  COUPON_INVALID: "couponInvalid",
  COUPON_NOT_STARTED: "couponNotStarted",
  COUPON_EXPIRED: "couponExpired",
  COUPON_USED_UP: "couponUsedUp",
  COUPON_FIRST_ORDER: "couponFirstOrder",
  COUPON_LIMIT_REACHED: "couponLimit",
  COUPON_WILAYA: "couponRegion",
  COUPON_NOT_APPLICABLE: "couponNoApply",
  DELIVERY_UNAVAILABLE: "deliveryGone",
  DUPLICATE_ORDER: "duplicateOrder",
  ACCOUNT_EXISTS: "accountExists",
};

export function localizeAppError(error: unknown, t: Record<string, string | undefined>): string {
  if (isAppError(error)) {
    const key = ERROR_MESSAGE_KEYS[error.code];
    const message = key ? t[key] : undefined;
    if (typeof message === "string" && message.length > 0) return message;
    return error.userMessage;
  }
  return toUserMessage(error);
}
