import type { InsulationMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Insulation cost — mirrors `Pricing - Insulated!G12`.
 *
 *   config.insulation     = material   (E37)  → "2\" Fiberglass Insulation" | "Moister Barrier Insulation (Prodex Total)"
 *   config.insulationType = coverage   (M37)  → "Vertical Roof Only" | "Fully Insulated-Vertical"
 *
 * For each surface the spreadsheet computes:
 *   roof  cost = ROUNDUP((width  + 3) × length          × rate, -1)
 *   sides cost = ROUNDUP((height + 2) × length × sidesQ × rate, -1)
 *   ends  cost = ROUNDUP((height + 3) × width  × endsQ  × rate, -1)
 *
 * "Vertical Roof Only" → roof only.
 * "Fully Insulated-Vertical" → roof + sides + ends.
 */
export function calcInsulation(config: BuildingConfig, matrices: InsulationMatrix & { raw?: RawGrid }): number {
  const material = (config.insulation ?? "").trim();
  const coverage = (config.insulationType ?? "").trim();
  if (!material || !coverage) return 0;

  const rate = matrices.materials?.find((m) => m.label === material)?.rate ?? 0;
  if (rate <= 0) {
    // Stale upload (pre-0.3.0) — fall back to the cached G12 cell so we don't
    // silently return 0 when the workbook had a number baked in.
    if (matrices.raw) return num(gridCell(matrices.raw, 12, "G"));
    return 0;
  }

  const { width, length, height, sidesQty, endsQty } = config;
  const roundUp10 = (n: number) => Math.ceil(n / 10) * 10;

  const roofCost = roundUp10((width + 3) * length * rate);
  if (/^Vertical Roof Only$/i.test(coverage)) return roofCost;

  if (/^Fully Insulated-Vertical$/i.test(coverage)) {
    const sidesCost = roundUp10((height + 2) * length * (sidesQty ?? 0) * rate);
    const endsCost = roundUp10((height + 3) * width * (endsQty ?? 0) * rate);
    return roofCost + sidesCost + endsCost;
  }

  return 0;
}
