import type { WorkSheet } from "xlsx";
import type { AnchorsMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";
import { getString, num } from "./utils";

/**
 * Pricing - Anchors — 67×26.
 *
 * Spreadsheet truth:
 *   - Anchor type labels live at A38:A43; their REAL unit prices are at O45:P50.
 *     (B38:B43 are zeros, not prices — easy mistake.)
 *   - Wind warranty list at F54:F56 is a *mode switch*, not additive prices.
 *     "105 MPH Wind Warranty" → use auto-computed qty (K47).
 *     "Anchors Only"          → use user-entered qty (K36).
 *   - Auto qty = perEndCount[`${width}x${sideMod}`] × 2 × mult,
 *       where sideMod = ceil(end-RUD count / endsQty)
 *       and mult = 0 for "Ground Concrete Supports", 1 otherwise.
 *   - per-end count table: A1:B33 ("12x0"→2, "24x0"→4, "24x1"→4, "24x2"→6, …)
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
    // G column is a formula cell, so capture label only.
    windWarranties.push({ label, price: 0 });
  }

  // Real unit prices at O45:P50.
  const unitPrices: { label: string; price: number }[] = [];
  for (let r = 45; r <= 50; r++) {
    const label = getString(sheet, `O${r}`);
    if (!label) continue;
    const price = num(sheet[`P${r}`]?.v);
    if (price <= 0) continue;
    unitPrices.push({ label, price });
  }

  // Per-end anchor count table at A1:B33.
  const perEndCounts: Record<string, number> = {};
  for (let r = 1; r <= 33; r++) {
    const key = getString(sheet, `A${r}`);
    if (!key) continue;
    const count = num(sheet[`B${r}`]?.v);
    if (count <= 0) continue;
    perEndCounts[key] = count;
  }

  // Sides anchor matrix at A36:S43. Row 36 is a base count row; row 37 is
  // length headers (B37=0, C37=20, ..., S37=100). Rows 38..43 hold the
  // per-length sides anchor count for each anchor type (some rows are all 0
  // — e.g. Concrete — meaning no side perimeter contribution).
  const lengthCols = ["B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S"];
  const lengthHeaders = lengthCols.map((c) => num(sheet[`${c}37`]?.v));
  const sidesAnchorsByTypeAndLength: Record<string, Record<number, number>> = {};
  for (let r = 38; r <= 43; r++) {
    const type = getString(sheet, `A${r}`);
    if (!type || /^0(\.0)?$/.test(type)) continue;
    const row: Record<number, number> = {};
    lengthCols.forEach((c, i) => {
      const len = lengthHeaders[i];
      if (len <= 0) return;
      const v = num(sheet[`${c}${r}`]?.v);
      row[len] = v;
    });
    sidesAnchorsByTypeAndLength[type] = row;
  }

  return {
    packages,
    windWarranties,
    unitPrices,
    perEndCounts,
    sidesAnchorsByTypeAndLength,
    raw: rawGrid(sheet, 67, 26),
  } as AnchorsMatrix & { raw: RawGrid };
}
