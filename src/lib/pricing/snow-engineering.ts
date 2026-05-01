import type { SnowMatrices } from "@/types/pricing";
import type { BuildingConfig, SnowEngineeringBreakdown } from "./types";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Snow engineering — port of `Snow - Math Calculations` sheet.
 *
 * Pipeline:
 *   1. Required spacing (Snow - Truss Spacing F52) keyed by snow/wind/leg/width
 *   2. Original count (Snow - Trusses BH11) — what's already included in base
 *   3. Extra trusses = ROUNDUP(L*12 / spacing) + 1 - original
 *   4. extras × pricePerTruss = extra cost
 *
 * The C102 kill-switch (in Snow - Changers!C102):
 *   = 1 if (wind > 130 OR snowLoad ≠ "30 Ground Load"), else 0
 *   When 0, no extra-truss/channel/etc. cost is charged (base building includes
 *   enough engineering for low-load builds in low-wind regions).
 *
 * Per-line item formula (from Snow - Math Calculations rows 12–22):
 *   P13 = extra trusses needed
 *   P14 = truss price per foot (Snow - Changers G76)
 *   P15 = P13 × P14
 *   P16 = leg-height price multiplier (Snow - Changers J72)
 *   P17 = max(legHeight - 6, 0)
 *   P19 = `tubing used` value (Z14 → Snow - Changers G31)
 *   P20 = P19 × P16
 *   P21 = P13 × P20
 *   P22 = (P15 + P21) × C102          ← TRUSS LINE-ITEM
 *
 * For hat channels:
 *   P25 = extra channels needed (G17)
 *   P26 = price per foot (Snow - Changers J75)
 *   P27 = length + 1
 *   P28 = P27 × P26
 *   P29 = P25 × P28                   ← CHANNEL LINE-ITEM
 *
 * For girts:
 *   T25 = width
 *   T26 = length
 *   T27 = side+end perimeter (V29 + V30)
 *   T28 = T27 × H26 (extra-girt count for V-sides only)
 *   T29 = price per foot (Snow - Changers J76, same as tubing)
 *   T30 = T28 × T29                   ← GIRT LINE-ITEM
 *
 * For verticals:
 *   U13 = extra verticals needed
 *   U16 = leg height + extra leg height
 *   U17 = price per foot tubing (Snow - Changers J76)
 *   U18 = U16 × U17 (price per vertical)
 *   U19 = U18 × U13                   ← VERTICAL LINE-ITEM
 *
 * Total = sum of 4 line items.
 */
export function calcSnowEngineering(
  config: BuildingConfig,
  snow: SnowMatrices
): SnowEngineeringBreakdown {
  const c102 = computeC102(config);

  // --- Trusses ---
  const trussSpacing = lookupTrussSpacing(config, snow);
  const originalTrusses = lookupOriginalTrusses(config, snow);
  const totalTrussesNeeded = trussSpacing > 0
    ? Math.ceil((config.length * 12) / trussSpacing) + 1
    : originalTrusses;
  const extraTrussesNeeded = Math.max(0, totalTrussesNeeded - originalTrusses);
  const trussPricePerFt = snow.changers.trussPrice;
  const legHeightMult = snow.changers.legHeightPrice;
  const extraLegHeight = lookupTubingUsed(config, snow); // G31 from Snow - Changers
  const trussExtraLegHeightPrice = extraLegHeight * legHeightMult;
  const trussLineCost = (extraTrussesNeeded * trussPricePerFt + extraTrussesNeeded * trussExtraLegHeightPrice) * c102;

  // --- Hat Channels ---
  // Spreadsheet formulas (Snow - Math Calculations rows 9–17):
  //   D10 = width
  //   D11 = D10 + 2                                  (e.g., 30+2 = 32)
  //   D12 = D11 / 2                                  (16)
  //   D13 = D12 * 12                                 (192 inches)
  //   D14 = D13 / spacing                            (192/36 = 5.33)
  //   D15 = ROUNDUP(D14, 0)                          (6)
  //   D16 = (D15 + 1) * 2                            (14 — total channels needed)
  //   D17 = (D16 - originalHatChannels) * verticalRoofFlag
  //   G17 = D17 clamped to ≥ 0                       (= extra channels)
  // P29 = G17 * (length+1) * pricePerFoot
  const hatChannelSpacing = lookupHatChannelSpacing(config, snow);
  const originalHatChannels = lookupOriginalHatChannels(config, snow);
  const isVerticalRoof = config.roofStyle === "A-Frame Vertical";
  const totalChannelsNeeded = hatChannelSpacing > 0
    ? (Math.ceil(((config.width + 2) / 2 * 12) / hatChannelSpacing) + 1) * 2
    : 0;
  const extraChannelsNeeded = isVerticalRoof
    ? Math.max(0, totalChannelsNeeded - originalHatChannels)
    : 0;
  const channelPricePerFt = snow.changers.pricePerFoot;
  const channelLineCost = extraChannelsNeeded * (config.length + 1) * channelPricePerFt;

  // --- Girts ---
  const girtSpacing = lookupGirtSpacing(config, snow);
  const originalGirts = lookupOriginalGirts(config, snow);
  const girtTotalNeeded = girtSpacing > 0 ? Math.ceil((config.height * 12) / girtSpacing) + 1 : 0;
  // Only on vertical sides AND only if both sides are V
  const sidesV = config.sidesPanel === "Vertical" ? 1 : 0;
  const endsEnclosed = config.ends === "Enclosed Ends" ? 1 : 0;
  const extraGirtsBase = Math.max(0, girtTotalNeeded - originalGirts);
  const extraGirtsNeeded = extraGirtsBase * sidesV * endsEnclosed;
  // Price-per-foot uses J76 (same as tubing)
  const sidesPerimeter = sidesV * config.sidesQty * config.length;
  const endsPerimeter = endsEnclosed * config.endsQty * config.width;
  const totalPerimeter = sidesPerimeter + endsPerimeter;
  const girtLineCost = totalPerimeter * extraGirtsNeeded * snow.changers.tubingPricePerFt;

  // --- Verticals ---
  const verticalSpacing = lookupVerticalSpacing(config, snow);
  const originalVerticals = lookupOriginalVerticals(config, snow);
  const totalVerticalsNeeded = verticalSpacing > 0
    ? Math.ceil((config.width * 12) / verticalSpacing) + 1
    : 0;
  const extraVerticalsBase = Math.max(0, totalVerticalsNeeded - originalVerticals);
  const extraVerticalsNeeded = extraVerticalsBase * endsEnclosed;
  const peakHeight = config.height + extraVerticalsBase; // approximation
  const verticalUnitPrice = peakHeight * snow.changers.tubingPricePerFt;
  const verticalLineCost = verticalUnitPrice * extraVerticalsNeeded;

  return {
    trussSpacing: trussSpacing > 0 ? `${trussSpacing}"` : "—",
    originalTrusses,
    extraTrussesNeeded,
    trussPrice: Math.round(trussLineCost),
    hatChannelSpacing: hatChannelSpacing > 0 ? `${hatChannelSpacing}"` : "—",
    originalHatChannels,
    extraChannelsNeeded,
    hatChannelPrice: Math.round(channelLineCost),
    girtSpacing: girtSpacing > 0 ? `${girtSpacing}"` : "—",
    originalGirts,
    extraGirtsNeeded,
    girtPrice: Math.round(girtLineCost),
    verticalSpacing: verticalSpacing > 0 ? `${verticalSpacing}"` : "—",
    originalVerticals,
    extraVerticalsNeeded,
    verticalPrice: Math.round(verticalLineCost),
    totalEngineering: Math.round(trussLineCost + channelLineCost + girtLineCost + verticalLineCost),
  };
}

/**
 * C102 = 1 if (wind > 130 OR snowLoad ≠ "30 Ground Load"), else 0.
 */
function computeC102(config: BuildingConfig): 0 | 1 {
  const isHighWind = config.windMph > 130;
  const isElevatedSnow = config.snowLoad !== "30 Ground Load";
  return isHighWind || isElevatedSnow ? 1 : 0;
}

// =============================================================================
// Sheet lookups — Phase 3 reads cached values; refinement in Phase 3b will trace
// the exact formulas in each sheet to compute these from arbitrary inputs.
// =============================================================================
function lookupTrussSpacing(_config: BuildingConfig, snow: SnowMatrices): number {
  // Snow - Truss Spacing!F52 is the resolved required spacing per the spreadsheet's
  // own internal formula chain. For the sample input it returns 36.
  // Phase 3b: trace the formula to compute from inputs.
  const grid = (snow.trusses as unknown as { spacingRaw?: RawGrid }).spacingRaw;
  return num(gridCell(grid ?? {}, 52, "F"));
}
function lookupOriginalTrusses(_config: BuildingConfig, snow: SnowMatrices): number {
  // Snow - Trusses!BH11 — sample resolves to 13.
  return num(gridCell((snow.trusses as unknown as { raw?: RawGrid }).raw ?? {}, 11, "BH"));
}
function lookupHatChannelSpacing(_config: BuildingConfig, snow: SnowMatrices): number {
  return num(gridCell((snow.hatChannels as unknown as { raw?: RawGrid }).raw ?? {}, 7, "L"));
}
function lookupOriginalHatChannels(_config: BuildingConfig, snow: SnowMatrices): number {
  return num(gridCell((snow.hatChannels as unknown as { raw?: RawGrid }).raw ?? {}, 10, "AD"));
}
function lookupGirtSpacing(_config: BuildingConfig, snow: SnowMatrices): number {
  return num(gridCell((snow.girts as unknown as { raw?: RawGrid }).raw ?? {}, 14, "F"));
}
function lookupOriginalGirts(_config: BuildingConfig, snow: SnowMatrices): number {
  return num(gridCell((snow.girts as unknown as { raw?: RawGrid }).raw ?? {}, 11, "T"));
}
function lookupVerticalSpacing(_config: BuildingConfig, snow: SnowMatrices): number {
  return num(gridCell((snow.verticals as unknown as { raw?: RawGrid }).raw ?? {}, 8, "Z"));
}
function lookupOriginalVerticals(_config: BuildingConfig, snow: SnowMatrices): number {
  return num(gridCell((snow.verticals as unknown as { raw?: RawGrid }).raw ?? {}, 21, "B"));
}
function lookupTubingUsed(_config: BuildingConfig, snow: SnowMatrices): number {
  // Snow - Changers!G31 — feeds Snow Math Z14 (Tubing Used). Sample = 28.
  // For phase 3 first cut we read it directly; engine should drive G31 from inputs in 3b.
  return num(gridCell((snow.changers as unknown as { raw?: RawGrid }).raw ?? {}, 31, "G"));
}
