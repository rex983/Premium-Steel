import type { WorkSheet } from "xlsx";
import type { SnowGirtsMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Snow - Girts — 32×62 (with trailing space: "Snow - Girts ").
 * Reference outputs:
 *   - 'Snow - Math Calculations'!P6 = 'Snow - Girts '!$F$14  (required girt spacing)
 *   - 'Snow - Math Calculations'!T6 = 'Snow - Girts '!$T$11  (original girts)
 */
export function readSnowGirts(sheet: WorkSheet): SnowGirtsMatrix {
  return {
    matrix: {},
    raw: rawGrid(sheet, 32, 62),
  } as SnowGirtsMatrix & { raw: RawGrid };
}
