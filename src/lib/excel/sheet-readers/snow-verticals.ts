import type { WorkSheet } from "xlsx";
import type { SnowVerticalsMatrix } from "@/types/pricing";
import { getNumber } from "./utils";
import { colToLetter } from "./_raw-grid";

/**
 * Snow - Verticals.
 *
 *   - B1:V1   leg-height header (0..20)
 *   - A2:A8   wind column (105..180)
 *   - B2:V8   required vertical spacing
 *   - B13:I13 truss-width header (12..30)
 *   - B14:I14 original vertical count per width
 */
export function readSnowVerticals(sheet: WorkSheet): SnowVerticalsMatrix {
  const legHeightHeader: number[] = [];
  for (let c = 2; c <= 22; c++) legHeightHeader.push(getNumber(sheet, colToLetter(c) + "1"));

  const windCol: number[] = [];
  const spacingTable: number[][] = [];
  for (let r = 2; r <= 8; r++) {
    windCol.push(getNumber(sheet, `A${r}`));
    const row: number[] = [];
    for (let c = 2; c <= 22; c++) row.push(getNumber(sheet, colToLetter(c) + r));
    spacingTable.push(row);
  }

  const widthHeader: number[] = [];
  const originalRow: number[] = [];
  for (let c = 2; c <= 9; c++) {
    widthHeader.push(getNumber(sheet, colToLetter(c) + "13"));
    originalRow.push(getNumber(sheet, colToLetter(c) + "14"));
  }

  return { legHeightHeader, windCol, spacingTable, widthHeader, originalRow };
}
