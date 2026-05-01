import type { LaborEquipmentMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Pricing - Labor-EQ!N29 — equipment / labor fees added on top of the subtotal.
 *
 * Sample value (south, default sample) = 2000.
 * Formula path requires tracing; for Phase 3 first cut we read the cached cell.
 */
export function calcEquipmentLabor(
  _config: BuildingConfig,
  matrices: LaborEquipmentMatrix & { raw?: RawGrid }
): number {
  if (matrices.raw) return num(gridCell(matrices.raw, 29, "N"));
  return 0;
}
