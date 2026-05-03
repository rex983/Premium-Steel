import type { WorkSheet } from "xlsx";
import type { SnowTrussSpacingMatrix } from "@/types/pricing";
import { getString, getNumber, num } from "./utils";
import { colToLetter } from "./_raw-grid";

/**
 * Snow - Truss Spacing — the master required-spacing matrix.
 *
 * Range: B1:HQ43 (74 cols × 43 rows of data + headers)
 *   - Row 1 cols B..HQ: column keys `${E|O}-{wind}-{trussWidthBucket}-{STD|AFV}`
 *   - Col A rows 2..43: row keys `${legSymbol}-{snowCode}` (T-30GL, ..., S-61LL)
 *   - B2:HQ43:           required spacing (inches)
 */
export function readSnowTrussSpacing(sheet: WorkSheet): SnowTrussSpacingMatrix {
  const colKeys: string[] = [];
  for (let c = 2; c <= 225; c++) {
    const v = getString(sheet, colToLetter(c) + "1");
    if (!v) break;
    colKeys.push(v);
  }

  const rowKeys: string[] = [];
  const spacingTable: number[][] = [];
  for (let r = 2; r <= 43; r++) {
    const key = getString(sheet, `A${r}`);
    if (!key) break;
    rowKeys.push(key);
    const row: number[] = [];
    for (let c = 2; c <= 1 + colKeys.length; c++) {
      row.push(num(getNumber(sheet, colToLetter(c) + r)));
    }
    spacingTable.push(row);
  }

  return { colKeys, rowKeys, spacingTable };
}
