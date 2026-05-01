/**
 * Engine helpers — generic lookup utilities for raw-grid matrices.
 */

export type RawGrid = Record<string, Record<string, unknown>>;

/** Get a cell value from a raw grid by row+col-letter. */
export function gridCell(grid: RawGrid, row: number, col: string): unknown {
  return grid?.[row]?.[col];
}

/** Coerce to number with fallback 0. */
export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return 0;
}

/** Coerce to string with fallback "". */
export function str(v: unknown): string {
  return v == null ? "" : String(v);
}

/** Convert 1-indexed column number to letter ("A", "B", ..., "AA"). */
export function colToLetter(col: number): string {
  let s = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

/** Convert column letter to 1-indexed number ("A"=1, "Z"=26, "AA"=27). */
export function letterToCol(letter: string): number {
  let n = 0;
  for (const ch of letter.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

/**
 * MATCH-equivalent: find the 1-indexed position of `needle` in `haystack`.
 * Returns 0 if not found (caller should handle).
 */
export function matchValue<T>(needle: T, haystack: readonly T[]): number {
  for (let i = 0; i < haystack.length; i++) {
    if (haystack[i] === needle) return i + 1;
  }
  return 0;
}

/**
 * MATCH with case-insensitive string matching.
 */
export function matchString(needle: string, haystack: readonly string[]): number {
  const n = needle.toLowerCase();
  for (let i = 0; i < haystack.length; i++) {
    if (haystack[i].toLowerCase() === n) return i + 1;
  }
  return 0;
}

/**
 * Read header row from a raw grid (row 1, cols startCol..endCol).
 */
export function readHeaderRow(grid: RawGrid, startColLetter: string, endColLetter: string): string[] {
  const start = letterToCol(startColLetter);
  const end = letterToCol(endColLetter);
  const headers: string[] = [];
  for (let c = start; c <= end; c++) {
    const v = gridCell(grid, 1, colToLetter(c));
    headers.push(str(v));
  }
  return headers;
}

/**
 * Read first column values from a raw grid (col A, rows startRow..endRow).
 */
export function readFirstColumn(grid: RawGrid, startRow: number, endRow: number, col = "A"): unknown[] {
  const vals: unknown[] = [];
  for (let r = startRow; r <= endRow; r++) {
    vals.push(gridCell(grid, r, col));
  }
  return vals;
}

/**
 * Read a range as a 2D array. Returns rows[row][col] keyed by 0-based offset.
 */
export function readRangeRows(
  grid: RawGrid,
  startRow: number,
  endRow: number,
  startColLetter: string,
  endColLetter: string
): unknown[][] {
  const start = letterToCol(startColLetter);
  const end = letterToCol(endColLetter);
  const rows: unknown[][] = [];
  for (let r = startRow; r <= endRow; r++) {
    const row: unknown[] = [];
    for (let c = start; c <= end; c++) {
      row.push(gridCell(grid, r, colToLetter(c)));
    }
    rows.push(row);
  }
  return rows;
}
