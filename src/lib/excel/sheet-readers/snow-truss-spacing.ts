import type { WorkSheet } from "xlsx";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Snow - Truss Spacing — 9817-cell matrix.
 * Reference output: Snow Math Calc P2 = 'Snow - Truss Spacing'!$F$52.
 *
 * 74×225 in size. Pure raw-grid for now; engine picks the right cell.
 */
export function readSnowTrussSpacing(sheet: WorkSheet): RawGrid {
  return rawGrid(sheet, 74, 225);
}
