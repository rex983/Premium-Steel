import type { WorkSheet } from "xlsx";
import type { EndsMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Pricing - Ends — 41×73 sheet, 656 formulas.
 * Reference output: PSB-Quote Sheet R28 = 'Pricing - Ends'!E27.
 */
export function readEnds(sheet: WorkSheet): EndsMatrix {
  return {
    prices: {},
    vSidesSurcharge: {},
    raw: rawGrid(sheet, 41, 73),
  } as EndsMatrix & { raw: RawGrid };
}
