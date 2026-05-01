import type { WorkSheet } from "xlsx";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Snow Load Breakdown — display layout for the engineering breakdown that's
 * referenced from PSB-Quote Sheet rows 56–63. Pure presentation; we capture the
 * raw grid for documentation but the engine doesn't need it.
 */
export function readSnowLoadBreakdown(sheet: WorkSheet): RawGrid {
  return rawGrid(sheet, 35, 26);
}
