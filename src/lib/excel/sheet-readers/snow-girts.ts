import type { WorkSheet } from "xlsx";
import type { SnowGirtsMatrix } from "@/types/pricing";
import { getNumber } from "./utils";
import { colToLetter } from "./_raw-grid";

/**
 * Snow - Girts.
 *
 *   - B1:H1     wind header (105..180)
 *   - A2:A6     girt-row keys (60,54,48,42,36 — bucketed truss spacings)
 *   - B2:H6     required girt spacing
 *   - L2:L22    leg-height column (0..20)
 *   - M2:M22    original girt count per leg height
 *   - B27:BJ27  truss-spacing → bucketed-truss-spacing map
 *   - B28:BJ28  raw truss-spacing axis (0..60)
 */
export function readSnowGirts(sheet: WorkSheet): SnowGirtsMatrix {
  const windHeader: number[] = [];
  for (let c = 2; c <= 8; c++) windHeader.push(getNumber(sheet, colToLetter(c) + "1"));

  const girtRowKeys: number[] = [];
  const spacingTable: number[][] = [];
  for (let r = 2; r <= 6; r++) {
    girtRowKeys.push(getNumber(sheet, `A${r}`));
    const row: number[] = [];
    for (let c = 2; c <= 8; c++) row.push(getNumber(sheet, colToLetter(c) + r));
    spacingTable.push(row);
  }

  const legHeightCol: number[] = [];
  const originalCol: number[] = [];
  for (let r = 2; r <= 22; r++) {
    legHeightCol.push(getNumber(sheet, `L${r}`));
    originalCol.push(getNumber(sheet, `M${r}`));
  }

  const trussSpacingAxis: number[] = [];
  const trussSpacingBucket: number[] = [];
  for (let c = 2; c <= 62; c++) {
    trussSpacingAxis.push(getNumber(sheet, colToLetter(c) + "28"));
    trussSpacingBucket.push(getNumber(sheet, colToLetter(c) + "27"));
  }

  return {
    girtRowKeys,
    windHeader,
    spacingTable,
    legHeightCol,
    originalCol,
    trussSpacingAxis,
    trussSpacingBucket,
  };
}
