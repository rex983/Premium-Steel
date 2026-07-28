import type { PromotionsMatrix } from "@/types/pricing";

/**
 * Promotions — pick a tier by name (dropdown selection), apply its % to the
 * line-item subtotal. Returned as NEGATIVE (Promotions!C8 = -E1 × B8).
 *
 * Special case: tiers flagged isManual (e.g. "Manual Discount") take their pct
 * from config.manualDiscount instead of the parsed tier value.
 */
export function calcPromoDiscount(
  tierLabel: string | undefined,
  matrices: PromotionsMatrix,
  lineItemSubtotal: number,
  manualDiscount?: number,
): number {
  if (!tierLabel || tierLabel === "No Promotional Sale") return 0;
  const tier = matrices.tiers.find((t) => t.label === tierLabel);
  if (!tier) return 0;
  const pct = tier.isManual ? (manualDiscount ?? 0) : tier.pct;
  if (!pct) return 0;
  return -Math.round(lineItemSubtotal * pct * 100) / 100;
}
