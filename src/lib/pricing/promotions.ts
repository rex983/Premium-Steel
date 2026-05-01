import type { PromotionsMatrix } from "@/types/pricing";

/**
 * Promotions — match a tier by name (which is what the user picks in the dropdown).
 * Returns the discount as a NEGATIVE number (Promotions!C10 = -E1 × B10).
 *
 * E1 (in spreadsheet) = SUM(R24:U52) + R55 = the line-item subtotal.
 * B10 = the chosen tier's pct.
 */
export function calcPromoDiscount(
  tierLabel: string | undefined,
  matrices: PromotionsMatrix,
  lineItemSubtotal: number
): number {
  if (!tierLabel || tierLabel === "No Promotional Sale") return 0;
  const tier = matrices.tiers.find((t) => t.label === tierLabel);
  if (!tier) return 0;
  return -Math.round(lineItemSubtotal * tier.pct * 100) / 100;
}
