import type { WorkSheet } from "xlsx";
import type { RoofStyleMatrix } from "@/types/pricing";

/**
 * Pricing - Roof Style — 33×28 sheet with upcharges by style × W × L.
 *
 * Without parsing every formula path, we capture every numeric cell tied to a
 * width header and length row, and let the engine do a width/length lookup at
 * compute time. The reference output (PSB-Quote Sheet R25 = 'Pricing - Roof Style'!E33)
 * is what we ultimately need to mirror, so we store the entire grid.
 *
 * For phase-2 first-pass we capture as a flat range. The engine's roof-style
 * resolver will do a key lookup. This can be refined once we trace the exact
 * formula in the spreadsheet (E33 vs E34 etc.).
 */
export function readRoofStyle(sheet: WorkSheet): RoofStyleMatrix {
  // Grab the entire range as a 2D array indexed by [row][col].
  const grid: Record<string, Record<string, unknown>> = {};
  for (let r = 1; r <= 33; r++) {
    for (let c = 1; c <= 28; c++) {
      const addr = colToLetter(c) + r;
      const v = sheet[addr]?.v;
      if (v !== undefined && v !== null) {
        if (!grid[r]) grid[r] = {};
        grid[r][colToLetter(c)] = v;
      }
    }
  }

  // For now we expose the flat grid; the engine can read it as raw lookup.
  // The shape here is meant as a placeholder until the full formula path is decoded.
  return {
    prices: { _raw: { 0: { 0: 0 } } },
    raw: grid,
  } as RoofStyleMatrix & { raw: typeof grid };
}

function colToLetter(col: number): string {
  let s = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
