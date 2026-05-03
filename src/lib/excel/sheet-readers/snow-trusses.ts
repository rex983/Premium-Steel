import type { WorkSheet } from "xlsx";
import type { SnowTrussesMatrix } from "@/types/pricing";
import { getString, getNumber } from "./utils";
import { colToLetter } from "./_raw-grid";

/**
 * Snow - Trusses — original truss count by (truss-width × state-code, length).
 *
 *   - Row 1 cols B..BE: keys `${trussWidth}-{stateCode}` (e.g. "30-IN")
 *   - Col A rows 2..101: lengths 1..100
 *   - B2:BE101: original truss count
 */
export function readSnowTrusses(sheet: WorkSheet): SnowTrussesMatrix {
  const colKeys: string[] = [];
  for (let c = 2; c <= 100; c++) {
    const v = getString(sheet, colToLetter(c) + "1");
    if (!v) break;
    colKeys.push(v);
  }

  const lengths: number[] = [];
  const counts: number[][] = [];
  for (let r = 2; r <= 101; r++) {
    const len = getNumber(sheet, `A${r}`);
    if (len <= 0) break;
    lengths.push(len);
    const row: number[] = [];
    for (let c = 2; c <= 1 + colKeys.length; c++) {
      row.push(getNumber(sheet, colToLetter(c) + r));
    }
    counts.push(row);
  }

  return { colKeys, lengths, counts };
}
