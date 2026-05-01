import type { RoofStyleMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { ROOF_STYLE_CODE } from "./constants";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Pricing - Roof Style
 *
 * Layout:
 *   Header row 1, cols B–AB: keys like "AFH-0", "AFH-12", ..., "AFV-30"
 *   Col A rows 2–19: lengths (0, 20, 25, ..., 100)
 *   Matrix B2:AB19: roof-style upcharges by length × style-width key
 *
 * E33 = IFERROR(INDEX(B2:AB19, F32, D32), 0)
 *   F32 = MATCH(length, A2:A19)             ← row keyed by length
 *   D32 = MATCH(`{styleCode}-{width}`, B1:AB1)
 *
 * For sample: length=50, width=30, AFV → key "AFV-30" (col 18) → INDEX row=8 col=18 = 1667.
 */
export function calcRoofStyle(config: BuildingConfig, matrices: RoofStyleMatrix & { raw?: RawGrid }): number {
  const grid = matrices.raw;
  if (!grid) return 0;
  const styleCode = ROOF_STYLE_CODE[config.roofStyle];
  if (!styleCode) return 0;
  const key = `${styleCode}-${config.width}`;

  const colIdx = findHeaderCol(grid, 1, key, "B", "AB");
  if (colIdx === 0) return 0;

  const rowIdx = findLengthRow(grid, config.length, 2, 19);
  if (rowIdx === 0) return 0;

  return num(gridCell(grid, rowIdx, colIdxToLetter(colIdx)));
}

function findHeaderCol(grid: RawGrid, row: number, key: string, startCol: string, endCol: string): number {
  const start = colIdxFromLetter(startCol);
  const end = colIdxFromLetter(endCol);
  for (let c = start; c <= end; c++) {
    const v = String(gridCell(grid, row, colIdxToLetter(c)) ?? "");
    if (v === key) return c;
  }
  return 0;
}
function findLengthRow(grid: RawGrid, length: number, startRow: number, endRow: number): number {
  for (let r = startRow; r <= endRow; r++) {
    const v = num(gridCell(grid, r, "A"));
    if (v === length) return r;
  }
  return 0;
}
function colIdxFromLetter(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function colIdxToLetter(col: number): string {
  let s = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
