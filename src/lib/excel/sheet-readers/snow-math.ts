import type { WorkSheet } from "xlsx";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Snow - Math Calculations — the engineering brain of the workbook.
 * 35×32, 107 formulas. Captures formulas like:
 *   D7 = ROUNDUP(L*12 / spacing) + 1 - originalTrusses  (extra trusses)
 *   D17 = (D16 - originalChannels) * H12                (extra channels)
 *   D26 = D25 * H24                                     (extra girts)
 *   D35 = (D34 - originalVerticals) * I35               (extra verticals)
 *   AD20 = total snow engineering price
 *
 * The cached values reflect the SAMPLE inputs in the workbook. The engine will
 * recompute these using the same logic on user inputs at compute time.
 */
export function readSnowMath(sheet: WorkSheet): RawGrid {
  return rawGrid(sheet, 35, 32);
}
