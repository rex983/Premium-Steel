import type { WorkSheet } from "xlsx";
import type { AnchorsMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";
import { getString, num } from "./utils";

/**
 * Pricing - Anchors — 67×26.
 * Defined-name sources:
 *   - Anchor      A38:A43    (6 anchor types)
 *   - Anchors     F54:F56    (MPH wind warranties)
 * Reference output: PSB-Quote Sheet R36 = 'Pricing - Anchors'!I57.
 */
export function readAnchors(sheet: WorkSheet): AnchorsMatrix {
  const packages = [];
  for (let r = 38; r <= 43; r++) {
    const label = getString(sheet, `A${r}`);
    if (!label) continue;
    packages.push({ label, price: num(sheet[`B${r}`]?.v) });
  }
  const windWarranties = [];
  for (let r = 54; r <= 56; r++) {
    const label = getString(sheet, `F${r}`);
    if (!label) continue;
    windWarranties.push({ label, price: num(sheet[`G${r}`]?.v) });
  }
  return {
    packages,
    windWarranties,
    raw: rawGrid(sheet, 67, 26),
  } as AnchorsMatrix & { raw: RawGrid };
}
