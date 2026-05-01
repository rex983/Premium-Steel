import type { LegsMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Pricing - Legs
 *
 * Layout:
 *   Header row 1, cols B–S: LENGTHS (0, 20, 25, 30, ..., 70)
 *   Col A rows 2–17: leg heights (0, 6, 7, 8, ..., 20)
 *   Matrix B2:S17: leg-height upcharges by length × legHeight
 *
 * E24 = INDEX(B2:S17, F22, D22)
 *   F22 = MATCH(legHeight, A2:A17)
 *   D22 = MATCH(length, B1:S1)   ← length is the column key, not width
 *
 * Note: spreadsheet applies gauge adjustment to legHeight via Pricing-Changers
 * before this lookup (B41 "Changed Legs"). 12G adds 3 to the height (15→18).
 * For phase-3 first cut we use the raw legHeight; refine when 12g case is needed.
 */
export function calcLegs(config: BuildingConfig, matrices: LegsMatrix & { raw?: RawGrid }): number {
  const grid = matrices.raw;
  if (!grid) return 0;
  const colIdx = findValueInRow(grid, 1, config.length, "B", "S");
  const rowIdx = findHeightRow(grid, config.height, 2, 17);
  if (colIdx === 0 || rowIdx === 0) return 0;
  return num(gridCell(grid, rowIdx, colIdxToLetter(colIdx)));
}

function findValueInRow(grid: RawGrid, row: number, value: number, startCol: string, endCol: string): number {
  const start = colIdxFromLetter(startCol);
  const end = colIdxFromLetter(endCol);
  for (let c = start; c <= end; c++) {
    const v = num(gridCell(grid, row, colIdxToLetter(c)));
    if (v === value) return c;
  }
  return 0;
}
function findHeightRow(grid: RawGrid, height: number, startRow: number, endRow: number): number {
  for (let r = startRow; r <= endRow; r++) {
    const v = num(gridCell(grid, r, "A"));
    if (v === height) return r;
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
