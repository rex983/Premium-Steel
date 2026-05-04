import type { AccessoriesMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Accessory line items.
 *
 * From spreadsheet result-cells:
 *   walk-in doors:  L12 = J12*K12, L13 = J13*K13       (qty × unit price)
 *   windows:        D18 = B18*C18, D19 = B19*C19       (qty × unit price)
 *   roll-up doors:  AC28 = Z28*AB28 etc.               (qty × unit price)
 *                   The roll-up size lookup feeds Z28 and AB28 from PSB-Quote Sheet.
 *   extras:         D32 = B32*C32, D33, D34            (qty × price)
 *   labor fees:     T42, T43 — XLOOKUP-based; Phase-3 simple pass uses 0
 *   foam closure:   AO6 = VLOOKUP(I43, AS5:AT6, 2, FALSE)
 *   base trim:      J22 = VLOOKUP(I22, H16:I17, 2, FALSE)
 *   gutter (Pricing-Base!AE28): IFERROR(AA27 * AA28, 0)
 *   color screws (Pricing-Base!N33): IFERROR(VLOOKUP(G45, M31:O32, 3, FALSE), 0)
 *   premium colors (Pricing-Base!V28): VLOOKUP(L49, U24:W26, 3, FALSE)
 *   26ga upgrade (Pricing-Base!N28): VLOOKUP(L48, M25:O27, 3, FALSE)
 */
export function calcWalkInDoors(
  config: BuildingConfig,
  matrices: AccessoriesMatrix
): number[] {
  const prices: number[] = [];
  for (const door of config.walkInDoors || []) {
    const item = matrices.walkInDoors.find((d) => d.label === door.size);
    prices.push(door.qty * (item?.price ?? 0));
  }
  while (prices.length < 2) prices.push(0);
  return prices;
}

export function calcWindows(
  config: BuildingConfig,
  matrices: AccessoriesMatrix
): number[] {
  const prices: number[] = [];
  for (const w of config.windows || []) {
    const item = matrices.windows.find((d) => d.label === w.size);
    prices.push(w.qty * (item?.price ?? 0));
  }
  while (prices.length < 2) prices.push(0);
  return prices;
}

export function calcRollUpDoors(
  config: BuildingConfig,
  matrices: AccessoriesMatrix
): number[] {
  // Spreadsheet formula (Pricing - Accessories!Z28..AC30):
  //   Y = VLOOKUP(size, P2:Q25, 2)              base price by size
  //   U = IFERROR(VLOOKUP(position, W5:X6, 2),0) SIDE→280, END→0
  //   AA = IFERROR(VLOOKUP(size, R1:T25, col),0) col=2 brush, 3 header-seal
  //   Z = Y + U + AA
  //   AC = Z × qty
  const prices: number[] = [];
  for (const door of config.rollUpDoors || []) {
    if (!door.size || door.qty <= 0) {
      prices.push(0);
      continue;
    }
    const base = matrices.rollUpDoors.find((d) => d.label === door.size)?.price ?? 0;
    const sideAdder =
      matrices.rudSidePositionAdders?.find((p) => p.label === door.position)?.price ?? 0;
    let sealAdder = 0;
    const seal = (door.headerSeal ?? "").trim();
    if (seal && matrices.rudSealAdders) {
      const sealRow = matrices.rudSealAdders.find((s) => s.size === door.size);
      if (sealRow) {
        if (seal.includes("Brush Seal Option")) sealAdder = sealRow.brushSeal;
        else if (seal.includes("Header Seal only Option")) sealAdder = sealRow.headerSeal;
      }
    }
    prices.push(door.qty * (base + sideAdder + sealAdder));
  }
  while (prices.length < 3) prices.push(0);
  return prices;
}

export function calcExtras(config: BuildingConfig, matrices: AccessoriesMatrix): number[] {
  // For Phase 3, use the parsed extras list and look up by label.
  const prices: number[] = [];
  for (const e of config.extras || []) {
    const item = matrices.extras.find((d) => d.label === e.label);
    prices.push(e.qty * (item?.price ?? 0));
  }
  while (prices.length < 2) prices.push(0);
  return prices;
}

export function calcInteriorWalls(config: BuildingConfig, matrices: AccessoriesMatrix): number {
  if (!config.interiorWalls) return 0;
  const item = matrices.interiorWalls.find((d) => d.label === config.interiorWalls!.label);
  return config.interiorWalls.qty * (item?.price ?? 0);
}

/**
 * Base Trim — Pricing - Accessories!J22 = VLOOKUP(G42, H16:I17, 2)
 *   I16 = ((width+length)*2) × G16    (perimeter × $/linear ft)
 * Only "Full Perimeter Base Trim" has a non-zero price; H17 is a blank fallback.
 */
export function calcBaseTrim(config: BuildingConfig, matrices: AccessoriesMatrix): number {
  if (!config.baseTrim) return 0;
  if (!/Full Perimeter/i.test(config.baseTrim)) return 0;
  const rate = matrices.bt ?? 0;
  const perimeter = (config.width + config.length) * 2;
  return Math.round(perimeter * rate);
}
/** Phase-3 placeholder: these accessory categories require deeper formula tracing. */
export function calcFoamClosure(_config: BuildingConfig, _matrices: AccessoriesMatrix): number { return 0; }
export function calc26gaUpgrade(_config: BuildingConfig, _matrices: AccessoriesMatrix): number { return 0; }
export function calcPremiumColors(_config: BuildingConfig, _matrices: AccessoriesMatrix): number { return 0; }
export function calcColorScrews(_config: BuildingConfig, _matrices: AccessoriesMatrix): number { return 0; }
export function calcGutter(_config: BuildingConfig, _matrices: AccessoriesMatrix): number { return 0; }
export function calcExtraSheetMetal(_config: BuildingConfig, _matrices: AccessoriesMatrix): number { return 0; }
export function calcFrameOuts(_config: BuildingConfig, _matrices: AccessoriesMatrix): number { return 0; }
export function calcJTrim(_config: BuildingConfig, _matrices: AccessoriesMatrix): number { return 0; }
export function calcLaborFees(_config: BuildingConfig, _matrices: AccessoriesMatrix): number[] { return [0, 0]; }
