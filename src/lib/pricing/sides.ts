import type { SidesMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { QTY_MULTIPLIER, ROOF_STYLE_CODE } from "./constants";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Pricing - Sides
 *
 * Layout:
 *   Header row 1, cols B–AK: width-orientation keys ("0-HZ","20-HZ",...,"30-V")
 *   Col A rows 2–20: leg-height options ("0' Sides Down" → 0, "3' Sides Down" → 3, ..., "20' Sides Down" → 20)
 *   Matrix B2:AK20: side-wall prices keyed by (legHeight, W-orientation)
 *
 * D28 = INDEX(matrix, F27, B27)
 *   F27 = MATCH(legHeight, sidesDownOptions)
 *   B27 = MATCH(`{LENGTH}-{orientation}`, headers)   ← keyed by LENGTH (the side wall's run), not width
 * D29 = sidesQty (0/1/2)
 * D30 = D28 × QTY_MULTIPLIER(D29) → final sides price
 *
 * Wainscot at F39/F41 follows the same pattern with the H36:AQ37 sub-matrix.
 */
export function calcSides(config: BuildingConfig, matrices: SidesMatrix & { raw?: RawGrid }): number {
  const grid = matrices.raw;
  if (!grid) return 0;

  const orientation = config.sidesPanel === "Vertical" ? "V" : "HZ";
  const widthKey = `${config.length}-${orientation}`;

  // Walk header row to find width-orientation column
  const colIdx = findHeaderCol(grid, 1, widthKey, "B", "AK");
  if (colIdx === 0) return 0;

  // Walk col A to find leg-height row
  const rowIdx = findLegHeightRow(grid, config.height, 2, 20);
  if (rowIdx === 0) return 0;

  const price = num(gridCell(grid, rowIdx, colIdxToLetter(colIdx)));
  return Math.round(price * QTY_MULTIPLIER(config.sidesQty));
}

export function calcWainscotSide(
  config: BuildingConfig,
  matrices: SidesMatrix & { raw?: RawGrid },
  wainscotQty: 0 | 1 | 2
): number {
  if (wainscotQty === 0 || !config.wainscotSide) return 0;
  const grid = matrices.raw;
  if (!grid) return 0;
  const orientation = config.sidesPanel === "Vertical" ? "V" : "HZ";
  // Wainscot side header at row 36, range H36:AQ37 — keyed by `{LENGTH}-{orientation}`
  const widthKey = `${config.length}-${orientation}`;
  const colIdx = findHeaderCol(grid, 36, widthKey, "H", "AQ");
  if (colIdx === 0) return 0;
  const price = num(gridCell(grid, 37, colIdxToLetter(colIdx)));
  return Math.round(price * QTY_MULTIPLIER(wainscotQty));
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
    const v = String(gridCell(grid, r, "A") ?? "");
    // Match either an exact number or a "{n}' Sides Down" pattern
    const m = v.match(/^(\d+)/);
    if (m && parseInt(m[1], 10) === height) return r;
  }
  return 0;
}

function colIdxFromLetter(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
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
