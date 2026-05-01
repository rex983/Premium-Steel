import type { WorkSheet } from "xlsx";
import type { SidesMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Pricing - Sides — 44×43 sheet with side-wall pricing by type × W × L × orientation.
 * Reference output: PSB-Quote Sheet R27 = 'Pricing - Sides'!$D$30 (one cell pulled).
 *
 * For phase 2 we capture the full grid raw; engine does the lookup based on
 * inputs (Fully Enclosed / Open, Vertical / Horizontal, qty).
 */
export function readSides(sheet: WorkSheet): SidesMatrix {
  return {
    prices: {},
    vSidesSurcharge: {},
    raw: rawGrid(sheet, 44, 43),
  } as SidesMatrix & { raw: RawGrid };
}
