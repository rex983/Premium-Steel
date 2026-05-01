import type { WorkSheet } from "xlsx";

/**
 * Helper for sheets we capture as full raw grids during Phase 2.
 *
 * As the engine matures (Phase 3), these will be replaced by structured readers
 * for each sheet. For now we keep all the cached values so the engine can
 * mirror the spreadsheet's lookups without the parser blocking on every detail.
 */
export type RawGrid = Record<string, Record<string, unknown>>;

export function rawGrid(sheet: WorkSheet, maxRow: number, maxCol: number): RawGrid {
  const grid: RawGrid = {};
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const addr = colToLetter(c) + r;
      const v = sheet[addr]?.v;
      if (v !== undefined && v !== null) {
        if (!grid[r]) grid[r] = {};
        grid[r][colToLetter(c)] = v;
      }
    }
  }
  return grid;
}

export function colToLetter(col: number): string {
  let s = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
