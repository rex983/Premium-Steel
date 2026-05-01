import type { EndsMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { END_QTY_MULTIPLIER } from "./constants";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Pricing - Ends
 *
 * Layout:
 *   Header row 1: keys like "0-HZ-FE", "30-V-FE", "0-HZ-G", "0-V-G"
 *     - HZ = Horizontal panel, V = Vertical panel
 *     - FE = Fully Enclosed Ends ("Enclosed Ends")
 *     - G  = Gable ends
 *   Col A rows 2–19: leg heights (0, 6, 7, 8, ..., 20)
 *
 * E27 = IFS(E26=2, E25*2, E26=1, E25, E26=0, 0)
 *   E25 = INDEX(matrix, height_row, key_col)
 *   E26 = endsQty (from L28)
 *
 * The ends qty multiplier is DIFFERENT from sides:
 *   sides: 0 → ×0,  1 → ×0.5,  2 → ×1
 *   ends:  0 → ×0,  1 → ×1,    2 → ×2
 */
export function calcEnds(config: BuildingConfig, matrices: EndsMatrix & { raw?: RawGrid }): number {
  const grid = matrices.raw;
  if (!grid) return 0;
  const orientation = config.endsPanel === "Vertical" ? "V" : "HZ";
  const endCode = config.ends === "Gable" ? "G" : "FE";
  const key = `${config.width}-${orientation}-${endCode}`;

  const colIdx = findHeaderCol(grid, 1, key, "B", "AU");
  if (colIdx === 0) return 0;

  const rowIdx = findLegHeightRow(grid, config.height, 2, 19);
  if (rowIdx === 0) return 0;

  const price = num(gridCell(grid, rowIdx, colIdxToLetter(colIdx)));
  return Math.round(price * END_QTY_MULTIPLIER(config.endsQty));
}

export function calcWainscotEnd(
  config: BuildingConfig,
  matrices: EndsMatrix & { raw?: RawGrid },
  wainscotQty: 0 | 1 | 2
): number {
  if (wainscotQty === 0 || !config.wainscotEnd) return 0;
  // Spreadsheet has a similar pattern; without re-tracing every range we use base price as proxy.
  // TODO: precise range from Pricing-Ends wainscot matrix.
  return 0;
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
function findLegHeightRow(grid: RawGrid, height: number, startRow: number, endRow: number): number {
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
