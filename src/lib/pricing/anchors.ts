import type { AnchorsMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Pricing - Anchors!I57 — single-cell reference. Internally:
 *   Anchor type (E36) + Wind warranty (L36) → looked up against:
 *     Anchor   (A38:A43)  — 6 anchor types
 *     Anchors  (F54:F56)  — 3 wind warranty levels
 *
 * Sample: anchor=Concrete + warranty=105MPH → 40
 *
 * Until full formula tracing, sum the chosen package + warranty prices from the
 * parsed lists. This works for the simple "single-anchor-type + single-warranty"
 * case. Edge cases (mixed anchors, no anchors) handled by treating absent inputs as 0.
 */
export function calcAnchors(config: BuildingConfig, matrices: AnchorsMatrix & { raw?: RawGrid }): number {
  let price = 0;
  if (config.anchorType) {
    const pkg = matrices.packages.find((p) => p.label === config.anchorType);
    if (pkg) price += pkg.price;
  }
  if (config.windWarranty) {
    const w = matrices.windWarranties.find((p) => p.label === config.windWarranty);
    if (w) price += w.price;
  }
  // Spreadsheet may apply a perimeter-based multiplier; refine in Phase 3b.
  // For now we read the cached I57 if present in raw grid for fidelity.
  if (matrices.raw) {
    const cached = num(gridCell(matrices.raw, 57, "I"));
    if (cached > 0 && price === 0) return cached;
  }
  return price;
}
