import type { LaborEquipmentMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";

/**
 * PSB-Quote AC36 = IFERROR(Pricing - Labor-EQ!N29, 0)
 *
 * Labor-EQ N29:
 *   C42 = INDEX(categoryMatrix, MATCH(height, heights), MATCH(width, widths))
 *   M25 = INDEX(rateMatrix,     MATCH(length, lengths), MATCH(width+cat, rateHeaders))
 *   N29 = IFS(C42="S", 0,
 *             C42="T",  totalTaxableSale * M25,
 *             C42="ET", M25)
 *
 * "S" states get no labor add-on. "T" states get a percentage of taxable sale
 * (small — 3%–5% depending on width). "ET" states get a flat $1500–$2000.
 */
export function calcEquipmentLabor(
  config: BuildingConfig,
  matrices: LaborEquipmentMatrix,
  totalTaxableSale: number,
): number {
  const { widths, heights, categoryMatrix, lengths, rateHeaders, rateMatrix } = matrices;
  if (
    !widths || !heights || !categoryMatrix ||
    !lengths || !rateHeaders || !rateMatrix
  ) {
    // Pre-0.3.x uploads lack the extracted matrices; skip rather than mis-price.
    return 0;
  }

  const widthIdx = nearestIndex(widths, config.width);
  const heightIdx = nearestIndex(heights, config.height);
  if (widthIdx < 0 || heightIdx < 0) return 0;

  const category = categoryMatrix[heightIdx]?.[widthIdx];
  if (!category || category === "S") return 0;

  const lengthIdx = nearestIndex(lengths, config.length);
  if (lengthIdx < 0) return 0;

  const rateWidth = widths[widthIdx];
  const rateHeader = `${rateWidth}${category}`;
  const rateColIdx = rateHeaders.indexOf(rateHeader);
  if (rateColIdx < 0) return 0;

  const rate = rateMatrix[lengthIdx]?.[rateColIdx] ?? 0;
  if (category === "T") return totalTaxableSale * rate;
  return rate; // "ET" flat
}

/** Match on exact if present, else the nearest entry ≤ target (spreadsheet MATCH behavior for sorted asc). */
function nearestIndex(arr: number[], target: number): number {
  const exact = arr.indexOf(target);
  if (exact >= 0) return exact;
  let best = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] <= target) best = i;
    else break;
  }
  return best;
}
