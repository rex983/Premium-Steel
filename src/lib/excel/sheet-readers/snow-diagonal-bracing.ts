import type { WorkSheet } from "xlsx";
import type { SnowDiagonalBracingMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Snow - Diagonal Bracing — 35×29 (south) / 35×28 (north — minor diff).
 */
export function readSnowDiagonalBracing(sheet: WorkSheet): SnowDiagonalBracingMatrix {
  return {
    matrix: {},
    raw: rawGrid(sheet, 35, 29),
  } as SnowDiagonalBracingMatrix & { raw: RawGrid };
}
