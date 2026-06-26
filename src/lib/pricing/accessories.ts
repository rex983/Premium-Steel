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
/**
 * Foam Closure — Pricing - Accessories!AO6 = VLOOKUP(I43, AS5:AT6, 2).
 * AT5 references a length-keyed price table (AI2:AT3): $525 at 20ft up to
 * $850 at 75ft. Engine matches by exact length, falling back to the largest
 * length not exceeding the building.
 */
export function calcFoamClosure(config: BuildingConfig, matrices: AccessoriesMatrix): number {
  const pick = (config.foamClosure ?? "").trim();
  if (!pick || pick === "0" || !matrices.foamClosure) return 0;
  if (pick !== matrices.foamClosure.label) return 0;
  const rows = matrices.foamClosure.byLength;
  if (rows.length === 0) return 0;
  const exact = rows.find((r) => r.length === config.length);
  if (exact) return exact.price;
  // No exact match: pick the row with length closest to (but not exceeding) the building
  const eligible = rows.filter((r) => r.length <= config.length);
  if (eligible.length === 0) return rows[0].price;
  return eligible[eligible.length - 1].price;
}

/**
 * Shared "rate × coverage" calculation used by 26ga / premium colors / color screws.
 *
 *   Roof Only      → rate × basePrice
 *   Fully Enclosed → rate × (basePrice + sidesPrice + endsPrice)
 *
 * Color screws encode coverage in the label itself.
 */
interface RateContext {
  basePrice: number;
  sidesPrice: number;
  endsPrice: number;
}

function rateCoverageCost(rate: number, coverage: string, ctx: RateContext): number {
  if (rate <= 0) return 0;
  if (/^Fully Enclosed/i.test(coverage)) {
    return Math.round((ctx.basePrice + ctx.sidesPrice + ctx.endsPrice) * rate);
  }
  if (/^Roof Only/i.test(coverage)) {
    return Math.round(ctx.basePrice * rate);
  }
  return 0;
}

/** 26ga Upgrade — Pricing - Base!N28 = VLOOKUP(L48, M25:O27, 3). */
export function calc26gaUpgrade(
  config: BuildingConfig,
  matrices: AccessoriesMatrix,
  ctx: RateContext,
): number {
  const panel = (config.upgrade26ga ?? "").trim();
  const coverage = (config.upgrade26gaCoverage ?? "").trim();
  if (!panel || !coverage || !matrices.upgrade26ga) return 0;
  const rate = matrices.upgrade26ga.find((p) => p.label.trim() === panel)?.rate ?? 0;
  return rateCoverageCost(rate, coverage, ctx);
}

/** Premium Colors — Pricing - Base!V28 = VLOOKUP(L49, U24:W26, 3). */
export function calcPremiumColors(
  config: BuildingConfig,
  matrices: AccessoriesMatrix,
  ctx: RateContext,
): number {
  const color = (config.premiumColor ?? "").trim();
  const coverage = (config.premiumColorCoverage ?? "").trim();
  if (!color || !coverage || !matrices.premiumColors) return 0;
  const rate = matrices.premiumColors.find((c) => c.label.trim() === color)?.rate ?? 0;
  return rateCoverageCost(rate, coverage, ctx);
}

/** Color Screws — Pricing - Base!N33 = VLOOKUP(G45, M31:O32, 3).
 *  Coverage is encoded in the label ("Roof Only - Color Screws" vs
 *  "Fully Enclosed - Color Screws Option"). */
export function calcColorScrews(
  config: BuildingConfig,
  matrices: AccessoriesMatrix,
  ctx: RateContext,
): number {
  const pick = (config.colorScrews ?? "").trim();
  if (!pick || !matrices.colorScrews) return 0;
  const row = matrices.colorScrews.find((c) => c.label.trim() === pick);
  if (!row) return 0;
  const coverage = /Fully Enclosed/i.test(row.label) ? "Fully Enclosed" : "Roof Only";
  return rateCoverageCost(row.rate, coverage, ctx);
}

/**
 * Gutter — Pricing - Base!AE28.
 *   AA25 = (length × mult) + 2.5
 *   AA26 = ((legHeight + 1.75) × (length/25)) × mult
 *   AA27 = AA25 + AA26
 *   AE28 = AA27 × 17.5
 */
export function calcGutter(config: BuildingConfig, matrices: AccessoriesMatrix): number {
  const side = (config.gutterSide ?? "").trim();
  if (!side || !matrices.gutter) return 0;
  const mult = matrices.gutter.sides.find((s) => s.label.trim() === side)?.multiplier ?? 0;
  if (mult <= 0) return 0;
  const { length, height } = config;
  const aa25 = length * mult + 2.5;
  const aa26 = (height + 1.75) * (length / 25) * mult;
  const lf = aa25 + aa26;
  return Math.round(lf * matrices.gutter.ratePerLf);
}

/**
 * Extra Sheet Metal — Pricing - Accessories!E42 = K46 (qty) × VLOOKUP(G46, A37:B40, 2).
 */
export function calcExtraSheetMetal(config: BuildingConfig, matrices: AccessoriesMatrix): number {
  const label = (config.extraSheetMetal ?? "").trim();
  const qty = config.extraSheetMetalQty ?? 0;
  if (!label || qty <= 0) return 0;
  const price = matrices.sheetMetal?.find((s) => s.label.trim() === label)?.price ?? 0;
  return Math.round(qty * price);
}

/** J-Trim — Pricing - Accessories!E43 = O46 (qty) × VLOOKUP(P46, C37:D40, 2). */
export function calcJTrim(config: BuildingConfig, matrices: AccessoriesMatrix): number {
  const label = (config.jtrim ?? "").trim();
  const qty = config.jtrimQty ?? 0;
  if (!label || qty <= 0) return 0;
  const price = matrices.jtrim?.find((j) => j.label.trim() === label)?.price ?? 0;
  return Math.round(qty * price);
}

/**
 * Frame Outs — Pricing - Accessories!Q50 = (O50 + R48) × Q48.
 *   O50 = price at (height, width) from O53:U62
 *   R48 = side adder at width (row 66); END = 0
 *   Q48 = qty
 */
export function calcFrameOuts(config: BuildingConfig, matrices: AccessoriesMatrix): number {
  const fo = config.frameOuts;
  if (!fo || fo.qty <= 0 || !matrices.frameOuts) return 0;
  const { heights, widths, prices, sideAdderByWidth } = matrices.frameOuts;
  const heightIdx = heights.indexOf(fo.height);
  const widthIdx = widths.indexOf(fo.width);
  if (heightIdx < 0 || widthIdx < 0) return 0;
  const base = prices[heightIdx]?.[widthIdx] ?? 0;
  const adder = fo.position === "SIDE" ? sideAdderByWidth[widthIdx] ?? 0 : 0;
  return Math.round((base + adder) * fo.qty);
}

/**
 * Labor Fees — Pricing - Accessories!T42/T43 = price[label][length], two
 * independent lines (G53 / G54 → R53 / R54).
 */
export function calcLaborFees(config: BuildingConfig, matrices: AccessoriesMatrix): number[] {
  const out: number[] = [];
  const fees = config.laborFees ?? [];
  const lf = matrices.laborFees;
  for (let i = 0; i < 2; i++) {
    const pick = (fees[i] ?? "").trim();
    if (!pick || !lf) { out.push(0); continue; }
    const labelIdx = lf.labels.findIndex((l) => l.trim() === pick);
    if (labelIdx < 0) { out.push(0); continue; }
    // Match by exact length, else largest length not exceeding building length.
    let lenIdx = lf.lengths.indexOf(config.length);
    if (lenIdx < 0) {
      const eligible = lf.lengths
        .map((l, idx) => ({ l, idx }))
        .filter(({ l }) => l <= config.length);
      lenIdx = eligible.length > 0 ? eligible[eligible.length - 1].idx : 0;
    }
    out.push(Math.round(lf.prices[labelIdx]?.[lenIdx] ?? 0));
  }
  return out;
}
