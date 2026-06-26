import type { WorkSheet } from "xlsx";
import type { InsulationMatrix } from "@/types/pricing";
import { num, str } from "./utils";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Pricing - Insulated — 20×20.
 *
 * The user picks two things on the quote sheet row 37:
 *   E37 = material  (drives the $/sqft rate)         — defined name `typei` = S2:S3
 *   M37 = coverage  (which surfaces are insulated)   — defined name `Insulated` = A11:A13
 *
 * Material rates (S2:T3):
 *   S2 "2\" Fiberglass Insulation"            T2 = 3.35
 *   S3 "Moister Barrier Insulation (Prodex Total)"  T3 = 1.5
 *
 * Coverage options (A11:A12):
 *   A11 "Vertical Roof Only"        → just the roof
 *   A12 "Fully Insulated-Vertical"  → roof + sides + ends
 *
 * Per-leg cost = ROUNDUP(area_sqft × rate, -1):
 *   roof  = (width  + 3) × length
 *   sides = (height + 2) × length × sidesQty
 *   ends  = (height + 3) × width  × endsQty
 *
 * The engine computes area from BuildingConfig; the parser only needs the
 * material rate table. We still capture the raw grid for a cached-G12
 * fallback when a stale upload lacks materials.
 */
export function readInsulation(sheet: WorkSheet): InsulationMatrix {
  const materials: { label: string; rate: number }[] = [];
  for (let r = 2; r <= 3; r++) {
    const label = str(sheet[`S${r}`]?.v);
    if (!label) continue;
    const rate = num(sheet[`T${r}`]?.v);
    if (rate <= 0) continue;
    materials.push({ label, rate });
  }
  return {
    materials,
    raw: rawGrid(sheet, 20, 20),
  } as InsulationMatrix & { raw: RawGrid };
}
