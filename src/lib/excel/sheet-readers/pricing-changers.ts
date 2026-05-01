import type { WorkSheet } from "xlsx";
import type { ChangersMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Pricing - Changers — 75×102. The "input router" sheet that translates user inputs
 * into matrix indices used by the rest of the engine. We don't need to evaluate its
 * formulas — we just need a few constants and to capture the raw grid for engine use.
 */
export function readChangers(sheet: WorkSheet): ChangersMatrix {
  return {
    buildingTypes: [],
    gaugeOptions: [],
    raw: rawGrid(sheet, 75, 102),
  } as ChangersMatrix & { raw: RawGrid };
}
