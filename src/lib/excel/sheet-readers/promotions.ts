import type { WorkSheet } from "xlsx";
import type { PromotionsMatrix, PromotionTier } from "@/types/pricing";
import { getString, getNumber } from "./utils";

/**
 * Promotions — user-selectable tiers from column A.
 * Layout (rows 3–8):
 *   A = label   B = pct (or user-input reference)   C = min subtotal   D = max subtotal
 *
 * Skip trailing rows used by the spreadsheet for helper cells:
 *   - Numeric-only labels (e.g. "0" placeholder in row 7 of the new sheet)
 *   - Label rows whose A-cell holds a formula pointing at the quote-sheet's
 *     tier-selection cell (row 8 in new sheet: A8 = 'PSB-Quote Sheet'!W24).
 *
 * The "Manual Discount" tier's percentage is a formula pointing at the quote
 * sheet's user-entered discount cell. We flag it with isManual so the engine
 * knows to consume config.manualDiscount instead of the parsed pct.
 */
export function readPromotions(sheet: WorkSheet): PromotionsMatrix {
  const tiers: PromotionTier[] = [];
  const seen = new Set<string>();

  for (let r = 3; r <= 8; r++) {
    const label = getString(sheet, `A${r}`).trim();
    if (!label) continue;

    // Skip placeholder rows: "0" or numeric-only labels.
    if (/^\d+$/.test(label)) continue;

    // Skip the "selected tier echo" row (its label is a formula result of the
    // quote-sheet's dropdown). Detected by matching a label we already saw —
    // the echo happens after the real tier rows.
    if (seen.has(label)) continue;

    // Manual Discount's B cell is a formula referencing user input; parsed pct
    // will be 0 (or the cached user value). Flag so engine reads config value.
    const isManual = /manual\s*discount/i.test(label);

    const pct = getNumber(sheet, `B${r}`);
    const minSubtotal = getNumber(sheet, `C${r}`);
    const maxRaw = sheet[`D${r}`]?.v;
    const maxSubtotal = typeof maxRaw === "number" ? maxRaw : null;

    tiers.push({ label, pct, minSubtotal, maxSubtotal, ...(isManual && { isManual: true }) });
    seen.add(label);
  }
  return { tiers };
}
