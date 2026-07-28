import type { LegsMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { gridCell, num, colToLetter, letterToCol, type RawGrid } from "./_helpers";

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
 * The Pricing-Changers B41/B50 "Changed Legs" transform is a low-height clamp only
 * (0-3→3, 4-5→6, 6+→self) — no gauge dependency. Pricing-Legs has no gauge
 * dimension either; 12g/14g gauge effect lives entirely in Pricing-Base.
 */
export function calcLegs(config: BuildingConfig, matrices: LegsMatrix & { raw?: RawGrid }): number {
  const grid = matrices.raw;
  if (!grid) return 0;
  const colIdx = findValueInRow(grid, 1, config.length, "B", "S");
  const rowIdx = findHeightRow(grid, config.height, 2, 17);
  if (colIdx === 0 || rowIdx === 0) return 0;
  return num(gridCell(grid, rowIdx, colToLetter(colIdx)));
}

function findValueInRow(grid: RawGrid, row: number, value: number, startCol: string, endCol: string): number {
  const start = letterToCol(startCol);
  const end = letterToCol(endCol);
  for (let c = start; c <= end; c++) {
    const v = num(gridCell(grid, row, colToLetter(c)));
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
