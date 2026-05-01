import type { WorkSheet } from "xlsx";
import type { LegsMatrix } from "@/types/pricing";

/**
 * Pricing - Legs — leg-height upcharge by gauge × leg height.
 * Sheet is 24×19. Reference output (PSB-Quote Sheet R26 = 'Pricing - Legs'!$E$24).
 *
 * Layout (best inferred from south dump):
 *   Likely: rows = gauges (12g, 14g) and columns = leg heights, or vice versa.
 *
 * Phase-2 first-pass: capture full grid as raw, refine after engine validation.
 */
export function readLegs(sheet: WorkSheet): LegsMatrix {
  const grid: Record<string, Record<string, unknown>> = {};
  for (let r = 1; r <= 24; r++) {
    for (let c = 1; c <= 19; c++) {
      const addr = colToLetter(c) + r;
      const v = sheet[addr]?.v;
      if (v !== undefined && v !== null) {
        if (!grid[r]) grid[r] = {};
        grid[r][colToLetter(c)] = v;
      }
    }
  }

  return {
    upcharges: {},
    raw: grid,
  } as LegsMatrix;
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
