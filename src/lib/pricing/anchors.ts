import type { AnchorsMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Anchor pricing — mirrors `Pricing - Anchors!I57`.
 *
 *   K47 (auto qty) = perEndCount[`${width}x${sideMod}`] × 2 × mult
 *     sideMod = ceil(end-RUD count / endsQty)
 *     mult    = 0 for "Ground Concrete Supports", 1 otherwise
 *   unitPrice = lookup of anchorType against O45:P50
 *
 *   Wind warranty switches mode:
 *     "105 MPH Wind Warranty" → unitPrice × K47   (auto qty)
 *     "Anchors Only"          → unitPrice × K36   (user qty from config.anchorQty)
 *     (anything else)         → 0
 */
export function calcAnchors(config: BuildingConfig, matrices: AnchorsMatrix & { raw?: RawGrid }): number {
  const anchorType = (config.anchorType ?? "").trim();
  const warranty = (config.windWarranty ?? "").trim();
  if (!anchorType || !warranty) return cachedI57(matrices, true);

  const unitPrice =
    matrices.unitPrices?.find((u) => u.label.trim() === anchorType)?.price ?? 0;
  if (unitPrice <= 0) return cachedI57(matrices, true);

  if (/Anchors\s*Only/i.test(warranty)) {
    const qty = config.anchorQty ?? 0;
    return Math.round(unitPrice * qty);
  }

  if (/Wind\s*Warranty/i.test(warranty)) {
    // Auto-qty path. Mirrors the K47=C50+J48 chain on Pricing - Anchors.
    //   J48 = perEnd × 2 × mult  (anchors at the building ends)
    //   C50 = sidesAnchorsByTypeAndLength[type][length]
    //         (anchors running along the side perimeter — type-dependent;
    //         Concrete contributes 0)
    const sideMod = computeSideMod(config);
    const mult = /Ground Concrete Supports/i.test(anchorType) ? 0 : 1;
    const perEnd = matrices.perEndCounts?.[`${config.width}x${sideMod}`] ?? 0;
    const endsAnchors = perEnd * 2 * mult;

    const sidesAnchors = lookupSidesAnchors(matrices, anchorType, config.length);
    const autoQty = endsAnchors + sidesAnchors;
    return Math.round(unitPrice * autoQty);
  }

  return cachedI57(matrices, true);
}

/**
 * sideMod = ROUNDUP(totalRudQty / endsCount). Matches Pricing - Anchors!E22,
 * which feeds the per-end count lookup key `${width}x${sideMod}`.
 *
 * Counterintuitive: the workbook sums ALL roll-up doors regardless of
 * position (=H33+H34+H35), not just end-mounted ones, despite the
 * neighbouring label "How Many Roll Up Doors are There on the end". The
 * label and the formula disagree; we mirror the formula because that's
 * what produces the $40 answer the user sees in the workbook.
 *
 * If ends aren't "Enclosed Ends" or endsQty=0, the spreadsheet's chain
 * errors out via VLOOKUP miss; we conservatively return 0 to avoid #N/A.
 */
function computeSideMod(config: BuildingConfig): number {
  if (!/Enclosed Ends/i.test(config.ends ?? "")) return 0;
  const endsCount = config.endsQty ?? 0;
  if (endsCount <= 0) return 0;
  const totalRuds = (config.rollUpDoors ?? [])
    .reduce((s, d) => s + (d.qty > 0 ? d.qty : 0), 0);
  return Math.min(3, Math.ceil(totalRuds / endsCount));
}

/**
 * Sides anchor count = matrix[anchorType][length]. The workbook's matrix
 * has discrete length columns (0, 20, 25, …, 100); for an in-between length
 * we round down to the nearest stored column (matches the spreadsheet's
 * dropdown-driven exact MATCH behavior for valid inputs).
 */
function lookupSidesAnchors(matrices: AnchorsMatrix, anchorType: string, length: number): number {
  const row = matrices.sidesAnchorsByTypeAndLength?.[anchorType];
  if (!row) return 0;
  if (row[length] !== undefined) return row[length];
  const lengths = Object.keys(row).map(Number).filter((n) => n <= length).sort((a, b) => a - b);
  return lengths.length > 0 ? row[lengths[lengths.length - 1]] : 0;
}

/** Pre-0.4.x stored matrices lacked unitPrices/perEndCounts. Fall back to
 *  the cached I57 cell from the workbook so the line doesn't silently zero. */
function cachedI57(matrices: AnchorsMatrix & { raw?: RawGrid }, onlyIfMissing: boolean): number {
  if (!matrices.raw) return 0;
  if (onlyIfMissing && (matrices.unitPrices?.length ?? 0) > 0) return 0;
  const v = num(gridCell(matrices.raw, 57, "I"));
  return v > 0 ? v : 0;
}
