import type { WorkSheet } from "xlsx";
import type { BaseMatrix } from "@/types/pricing";
import { getString, getNumber, num } from "./utils";

/**
 * Pricing - Base sheet — main W×L×Gauge price matrix.
 *
 * Layout (1-indexed):
 *   - Row 1 cols B–S: width-gauge headers ("0-14G", "12-14G", ..., "30-12G")
 *   - Col A rows 2–19: lengths (0, 20, 25, 30, ..., 100)
 *   - Cells B2:S19: prices (some hardcoded, some =Cn+Cn+1 averages — but cached values
 *     are what we read)
 *
 * Roof pitch table starts at row 35 (A35:J39).
 * Overhang table starts at row 46 (A46:U48 ish).
 */
export function readBase(sheet: WorkSheet): BaseMatrix {
  const widthGaugeKeys: string[] = [];
  // Read header row 1, columns B–S (cols 2–19)
  for (let c = 2; c <= 19; c++) {
    const addr = colToLetter(c) + "1";
    const v = getString(sheet, addr);
    if (v) widthGaugeKeys.push(v);
  }

  const lengths: number[] = [];
  // Read column A rows 2–19
  for (let r = 2; r <= 19; r++) {
    const v = getNumber(sheet, `A${r}`);
    if (v > 0) lengths.push(v);
  }

  const prices: Record<string, number> = {};
  // Cells B2:S19
  for (let r = 2; r <= 19; r++) {
    const length = getNumber(sheet, `A${r}`);
    if (length <= 0) continue;
    for (let c = 2; c <= 19; c++) {
      const widthKey = getString(sheet, colToLetter(c) + "1");
      if (!widthKey) continue;
      const price = getNumber(sheet, colToLetter(c) + r);
      if (price > 0) {
        prices[`${length}|${widthKey}`] = price;
      }
    }
  }

  return { lengths, widthGaugeKeys, prices };
}

/**
 * Roof pitch upcharge — small matrix at A35:J39.
 * Header row 35 cols B–J: widths (0, 12, 18, 20, 22, 24, 26, 28, 30).
 * Col A rows 36–39: pitch labels (4-12P, 5-12P, 6-12P, 0-12p).
 * Cells contain a multiplier (e.g. 0.12 means 12% added).
 */
export function readRoofPitch(sheet: WorkSheet): Record<string, Record<number, number>> {
  const widths: number[] = [];
  for (let c = 2; c <= 10; c++) {
    const v = getNumber(sheet, colToLetter(c) + "35");
    widths.push(v);
  }
  const result: Record<string, Record<number, number>> = {};
  for (let r = 36; r <= 39; r++) {
    const pitch = getString(sheet, `A${r}`);
    if (!pitch) continue;
    result[pitch] = {};
    for (let c = 2; c <= 10; c++) {
      const w = widths[c - 2];
      const v = getNumber(sheet, colToLetter(c) + r);
      result[pitch][w] = v;
    }
  }
  return result;
}

/**
 * Overhang multiplier table at row 46 (header) and rows 47–49 (12"OH / 18"OH / none).
 * Cols D–U at row 46: lengths (0, 20, 25, ..., 100). Col A47/A48 = label.
 */
export function readOverhang(sheet: WorkSheet): Record<string, Record<number, number>> {
  const lengths: number[] = [];
  for (let c = 4; c <= 21; c++) {
    const v = getNumber(sheet, colToLetter(c) + "46");
    lengths.push(v);
  }
  const result: Record<string, Record<number, number>> = {};
  for (let r = 47; r <= 49; r++) {
    const label = getString(sheet, `A${r}`);
    if (!label) continue;
    result[label] = {};
    for (let c = 4; c <= 21; c++) {
      const len = lengths[c - 4];
      const v = num(sheet[colToLetter(c) + r]?.v);
      result[label][len] = v;
    }
  }
  return result;
}

/** Convert 1-indexed column number to letter ("A", "B", ..., "Z", "AA", ...). */
function colToLetter(col: number): string {
  let s = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
