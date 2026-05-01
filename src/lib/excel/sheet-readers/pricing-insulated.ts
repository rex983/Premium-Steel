import type { WorkSheet } from "xlsx";
import type { InsulationMatrix } from "@/types/pricing";
import { getString, num } from "./utils";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Pricing - Insulated — 20×20.
 * Defined-name sources:
 *   - Insulated  A11:A13    (3 options: 2" Fiberglass / DBL Bubble / etc.)
 *   - typei      S2:S3      (Roof Only / Fully)
 * Reference output: PSB-Quote Sheet R37 = 'Pricing - Insulated'!G12.
 */
export function readInsulation(sheet: WorkSheet): InsulationMatrix {
  const options = [];
  for (let r = 11; r <= 13; r++) {
    const label = getString(sheet, `A${r}`);
    if (!label) continue;
    // The price columns vary by coverage type; capture both columns we know about.
    const roofOnly = num(sheet[`B${r}`]?.v);
    const full = num(sheet[`C${r}`]?.v);
    options.push({ label, type: "RoofOnly", coverage: "Roof Only", price: roofOnly });
    options.push({ label, type: "Fully", coverage: "Fully Insulated", price: full });
  }
  return {
    options,
    raw: rawGrid(sheet, 20, 20),
  } as InsulationMatrix & { raw: RawGrid };
}
