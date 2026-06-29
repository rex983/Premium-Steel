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
 * MATCH with case-insensitive string matching. Returns 1-indexed position, 0 if not found.
 */
export function matchString(needle: string, haystack: readonly string[]): number {
  const n = needle.toLowerCase();
  for (let i = 0; i < haystack.length; i++) {
    if (haystack[i].toLowerCase() === n) return i + 1;
  }
  return 0;
}
