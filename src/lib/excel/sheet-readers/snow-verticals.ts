import type { WorkSheet } from "xlsx";
import type { SnowVerticalsMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Snow - Verticals — 21×29.
 * Reference outputs:
 *   - 'Snow - Math Calculations'!P8 = 'Snow - Verticals'!$Z$8  (required vertical spacing)
 *   - 'Snow - Math Calculations'!T8 = 'Snow - Verticals'!$B$21 (original vertical count)
 */
export function readSnowVerticals(sheet: WorkSheet): SnowVerticalsMatrix {
  return {
    matrix: {},
    raw: rawGrid(sheet, 21, 29),
  } as SnowVerticalsMatrix & { raw: RawGrid };
}
