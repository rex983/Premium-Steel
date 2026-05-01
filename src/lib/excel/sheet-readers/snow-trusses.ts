import type { WorkSheet } from "xlsx";
import type { SnowTrussesMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Snow - Trusses — 5327-formula matrix giving the original truss count.
 * Reference output: Snow Math Calc T2 = 'Snow - Trusses '!$BH$11 (a single cell).
 *
 * Sheet is 101×63. The cells are formulas referencing 'Snow - Truss Spacing' and
 * 'Snow - Changers'. We capture cached values as a raw grid; the engine selects
 * the right cell using the same input routing the spreadsheet does.
 */
export function readSnowTrusses(sheet: WorkSheet): SnowTrussesMatrix {
  return {
    counts: {},
    spacing: {},
    raw: rawGrid(sheet, 101, 63),
  } as SnowTrussesMatrix & { raw: RawGrid };
}
