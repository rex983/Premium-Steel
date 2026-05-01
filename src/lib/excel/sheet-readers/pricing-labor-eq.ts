import type { WorkSheet } from "xlsx";
import type { LaborEquipmentMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Pricing - Labor-EQ — 42×25 sheet.
 * Reference: PSB-Quote Sheet AC36 = IFERROR('Pricing - Labor-EQ'!N29,0)
 *
 * Phase 2 first-pass: capture raw grid; engine traces the formula path.
 */
export function readLaborEquipment(sheet: WorkSheet): LaborEquipmentMatrix {
  return {
    laborOptions: [],
    equipmentOptions: [],
    raw: rawGrid(sheet, 42, 25),
  } as LaborEquipmentMatrix & { raw: RawGrid };
}
