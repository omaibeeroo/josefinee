/**
 * Pure promotion math — no server-only imports so it stays unit-testable.
 * Percentages are always capped at 90% and fixed amounts at the subtotal.
 */
export function promotionDiscountFor(
  promotion: { type: "PERCENTAGE" | "FIXED"; value: number },
  eligibleSubtotal: number,
): number {
  if (eligibleSubtotal <= 0) return 0;
  if (promotion.type === "PERCENTAGE") {
    const percent = Math.min(90, Math.max(1, promotion.value));
    return Math.floor((eligibleSubtotal * percent) / 100);
  }
  return Math.min(Math.max(0, promotion.value), eligibleSubtotal);
}
