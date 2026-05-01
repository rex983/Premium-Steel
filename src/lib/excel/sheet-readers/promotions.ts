import type { WorkSheet } from "xlsx";
import type { PromotionsMatrix, PromotionTier } from "@/types/pricing";
import { getString, getNumber } from "./utils";

/**
 * Promotions — 6 winter-sale tiers keyed by subtotal range.
 * Layout (rows 3–8):
 *   A   = label   B = pct   C = min subtotal   D = max subtotal
 */
export function readPromotions(sheet: WorkSheet): PromotionsMatrix {
  const tiers: PromotionTier[] = [];
  for (let r = 3; r <= 8; r++) {
    const label = getString(sheet, `A${r}`);
    if (!label) continue;
    const pct = getNumber(sheet, `B${r}`);
    const minSubtotal = getNumber(sheet, `C${r}`);
    const maxRaw = sheet[`D${r}`]?.v;
    const maxSubtotal = (typeof maxRaw === "number") ? maxRaw : null;
    tiers.push({ label, pct, minSubtotal, maxSubtotal });
  }
  return { tiers };
}
