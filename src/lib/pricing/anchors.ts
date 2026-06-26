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
    // Auto-qty path. Per-end count looked up by `${width}x${sideMod}`.
    const sideMod = computeSideMod(config);
    const mult = /Ground Concrete Supports/i.test(anchorType) ? 0 : 1;
    const perEnd = matrices.perEndCounts?.[`${config.width}x${sideMod}`] ?? 0;
    const autoQty = perEnd * 2 * mult;
    return Math.round(unitPrice * autoQty);
  }

  return cachedI57(matrices, true);
}

/** sideMod = ceil(end-RUD count / endsQty), clamped to [0, 3]. */
function computeSideMod(config: BuildingConfig): number {
  const endRuds = (config.rollUpDoors ?? [])
    .filter((d) => d.position === "END" && d.qty > 0)
    .reduce((s, d) => s + d.qty, 0);
  const ends = Math.max(1, config.endsQty ?? 2);
  return Math.min(3, Math.ceil(endRuds / ends));
}

/** Pre-0.4.x stored matrices lacked unitPrices/perEndCounts. Fall back to
 *  the cached I57 cell from the workbook so the line doesn't silently zero. */
function cachedI57(matrices: AnchorsMatrix & { raw?: RawGrid }, onlyIfMissing: boolean): number {
  if (!matrices.raw) return 0;
  if (onlyIfMissing && (matrices.unitPrices?.length ?? 0) > 0) return 0;
  const v = num(gridCell(matrices.raw, 57, "I"));
  return v > 0 ? v : 0;
}
