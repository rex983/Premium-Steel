import type { WorkSheet } from "xlsx";
import type { SnowHatChannelsMatrix } from "@/types/pricing";
import { getString, getNumber } from "./utils";
import { colToLetter } from "./_raw-grid";

/**
 * Snow - Hat Channels.
 *
 * Two independent lookup blocks live on this sheet:
 *
 * (a) Required HC spacing
 *     - B1:H1   wind values (105/115/130/140/155/165/180)
 *     - A2:A71  row keys `${HCWidthBucket}-{snowCode}` (60-30GL, ..., 36-61LL)
 *     - B2:H71  required spacing
 *
 * (b) Original hat channel count
 *     - R2:R8   state codes (PA, TX, IL, MO, WI, MI, IN)
 *     - S1:Z1   width header (12,18,20,22,24,26,28,30)
 *     - S2:Z8   original hat-channel count per (state, truss-width)
 */
export function readSnowHatChannels(sheet: WorkSheet): SnowHatChannelsMatrix {
  // (a) spacing
  const windHeader: number[] = [];
  for (let c = 2; c <= 8; c++) {
    windHeader.push(getNumber(sheet, colToLetter(c) + "1"));
  }
  const rowKeys: string[] = [];
  const spacingTable: number[][] = [];
  for (let r = 2; r <= 71; r++) {
    const key = getString(sheet, `A${r}`);
    if (!key) break;
    rowKeys.push(key);
    const row: number[] = [];
    for (let c = 2; c <= 8; c++) {
      row.push(getNumber(sheet, colToLetter(c) + r));
    }
    spacingTable.push(row);
  }

  // (b) original counts
  const widthHeader: number[] = [];
  for (let c = 19; c <= 26; c++) {
    widthHeader.push(getNumber(sheet, colToLetter(c) + "1"));
  }
  const stateCodes: string[] = [];
  const originalCounts: number[][] = [];
  for (let r = 2; r <= 8; r++) {
    const code = getString(sheet, `R${r}`);
    if (!code) break;
    stateCodes.push(code);
    const row: number[] = [];
    for (let c = 19; c <= 26; c++) {
      row.push(getNumber(sheet, colToLetter(c) + r));
    }
    originalCounts.push(row);
  }

  return { rowKeys, windHeader, spacingTable, stateCodes, widthHeader, originalCounts };
}
