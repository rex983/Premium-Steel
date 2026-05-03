import type { SnowMatrices, SnowChangersMatrix, SnowStateConstants } from "@/types/pricing";
import type { BuildingConfig, SnowEngineeringBreakdown } from "./types";
import { matchString } from "./_helpers";

/**
 * Snow engineering — port of the `Snow - *` sheets' INDEX/MATCH chains.
 *
 * The spreadsheet computes every "extra" engineering line item via lookups
 * keyed off runtime inputs (snow load, wind, leg height, width, length, state,
 * ends/open, roof style). Earlier versions of this engine read cached output
 * cells from each sheet — those values are frozen at whatever inputs the
 * workbook was last saved with, which is why the app's numbers diverged from
 * the spreadsheet for any other input combination. This rewrite walks the
 * same lookup chain at request time using the parsed lookup tables.
 *
 * Pipeline (mirrors the spreadsheet):
 *   1. Required spacing  ← Snow - Truss Spacing  (snow + leg + width + wind + ends + style)
 *   2. Original count    ← Snow - Trusses        (state + width + length)
 *   3. extras = ROUNDUP(L*12 / spacing) + 1 - original
 *   4. extras × pricePerTruss × C102            = TRUSS LINE-ITEM (P22)
 *
 * Hat channels / girts / verticals follow the same shape against their own
 * lookup tables. C102 is the kill switch: 0 if wind ≤ 130 AND snow == 30GL.
 */
export function calcSnowEngineering(
  config: BuildingConfig,
  snow: SnowMatrices
): SnowEngineeringBreakdown {
  const ctx = resolveInputs(config, snow.changers);
  const c102 = computeC102(config, ctx.snowCode);

  // --- Trusses ---
  const trussSpacing = lookupTrussSpacing(config, ctx, snow);
  const originalTrusses = lookupOriginalTrusses(config, ctx, snow);
  const totalTrussesNeeded = trussSpacing > 0
    ? Math.ceil((config.length * 12) / trussSpacing) + 1
    : originalTrusses;
  const extraTrussesNeeded = Math.max(0, totalTrussesNeeded - originalTrusses);
  const trussPricePerFt = ctx.stateConst?.trussPriceByWidth[ctx.trussWidth] ?? 0;
  const legHeightMult = ctx.stateConst?.legHeightMult ?? 0;
  const tubingFeet = snow.changers.legHeightTubingFeet[config.height] ?? 0;
  const trussExtraLegHeightPrice = tubingFeet * legHeightMult;
  const trussLineCost = (extraTrussesNeeded * trussPricePerFt + extraTrussesNeeded * trussExtraLegHeightPrice) * c102;

  // --- Hat Channels ---
  const hatChannelSpacing = lookupHatChannelSpacing(config, ctx, snow);
  const originalHatChannels = lookupOriginalHatChannels(ctx, snow);
  const isVerticalRoof = config.roofStyle === "A-Frame Vertical";
  const totalChannelsNeeded = hatChannelSpacing > 0
    ? (Math.ceil(((config.width + 2) / 2 * 12) / hatChannelSpacing) + 1) * 2
    : 0;
  const extraChannelsNeeded = isVerticalRoof
    ? Math.max(0, totalChannelsNeeded - originalHatChannels)
    : 0;
  const channelPricePerFt = ctx.stateConst?.channelPricePerFt ?? 0;
  const channelLineCost = extraChannelsNeeded * (config.length + 1) * channelPricePerFt;

  // --- Girts ---
  const girtSpacing = lookupGirtSpacing(trussSpacing, config, snow);
  const originalGirts = lookupOriginalGirts(config.height, snow);
  const girtTotalNeeded = girtSpacing > 0 ? Math.ceil((config.height * 12) / girtSpacing) + 1 : 0;
  const sidesV = config.sidesPanel === "Vertical" ? 1 : 0;
  const endsEnclosed = config.ends === "Enclosed Ends" ? 1 : 0;
  const extraGirtsBase = Math.max(0, girtTotalNeeded - originalGirts);
  const extraGirtsNeeded = extraGirtsBase * sidesV * endsEnclosed;
  const sidesPerimeter = sidesV * config.sidesQty * config.length;
  const endsPerimeter = endsEnclosed * config.endsQty * config.width;
  const totalPerimeter = sidesPerimeter + endsPerimeter;
  const tubingPricePerFt = ctx.stateConst?.tubingPricePerFt ?? 0;
  const girtLineCost = totalPerimeter * extraGirtsNeeded * tubingPricePerFt;

  // --- Verticals ---
  const verticalSpacing = lookupVerticalSpacing(config, snow);
  const originalVerticals = lookupOriginalVerticals(ctx, snow);
  const totalVerticalsNeeded = verticalSpacing > 0
    ? Math.ceil((config.width * 12) / verticalSpacing) + 1
    : 0;
  const extraVerticalsBase = Math.max(0, totalVerticalsNeeded - originalVerticals);
  const extraVerticalsNeeded = extraVerticalsBase * endsEnclosed;
  const peakHeight = config.height + extraVerticalsBase;
  const verticalUnitPrice = peakHeight * tubingPricePerFt;
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

// ============================================================================
// Input routing — resolves runtime BuildingConfig into the bucketed/encoded
// values the lookup tables expect.
// ============================================================================
interface ResolvedInputs {
  snowCode: string;          // e.g. "30GL"
  legSymbol: string;         // "S" | "M" | "T"
  hcWidth: number;           // hat-channel width bucket
  trussWidth: number;        // truss-width bucket
  endsCode: "E" | "O";       // E = enclosed ends, O = open
  styleCode: "AFV" | "STD";  // roof-style code in truss-spacing keys
  stateConst?: SnowStateConstants;
}

function resolveInputs(config: BuildingConfig, ch: SnowChangersMatrix): ResolvedInputs {
  const snowCode = ch.snowLoadNameToCode[config.snowLoad] ?? "30GL";
  const legSymbol = ch.legHeightSymbol[config.height] ?? "S";
  const hcWidth = ch.hcWidthBucket[config.width] ?? config.width;
  const trussWidth = ch.trussWidthBucket[config.width] ?? config.width;
  const endsCode: "E" | "O" = config.ends === "Enclosed Ends" ? "E" : "O";
  const styleCode: "AFV" | "STD" = config.roofStyle === "A-Frame Vertical" ? "AFV" : "STD";
  const stateConst = ch.byStateName[config.state];
  return { snowCode, legSymbol, hcWidth, trussWidth, endsCode, styleCode, stateConst };
}

// C102 = 1 if (wind > 130 OR snowCode != "30GL"), else 0.
function computeC102(config: BuildingConfig, snowCode: string): 0 | 1 {
  const isHighWind = config.windMph > 130;
  const isElevatedSnow = snowCode !== "30GL";
  return isHighWind || isElevatedSnow ? 1 : 0;
}

// ============================================================================
// Lookups
// ============================================================================
function lookupTrussSpacing(
  config: BuildingConfig,
  ctx: ResolvedInputs,
  snow: SnowMatrices
): number {
  const ts = snow.trussSpacing;
  if (!ts?.rowKeys?.length || !ts.colKeys?.length) return 0;

  const rowKey = `${ctx.legSymbol}-${ctx.snowCode}`;
  const colKey = `${ctx.endsCode}-${config.windMph}-${ctx.trussWidth}-${ctx.styleCode}`;

  const rowIdx = matchString(rowKey, ts.rowKeys);
  const colIdx = matchString(colKey, ts.colKeys);
  if (rowIdx === 0 || colIdx === 0) return 0;

  const raw = ts.spacingTable[rowIdx - 1]?.[colIdx - 1] ?? 0;

  // F52 = E52, where E52 = F51 - H52 - Q49.
  // Q47 = IF(legHeight > 14, 1, 0); Q48 = F94 lookup; Q49 = Q47 × Q48. H52 = West-Coast 6"
  // spacer (irregular-building flag) — we don't model irregular yet, so 0.
  const q47 = config.height > 14 ? 1 : 0;
  const q48 = snow.changers.legHeightAdjust[ctx.trussWidth]?.[ctx.snowCode] ?? 0;
  const q49 = q47 * q48;
  const e52 = raw - q49;
  // F52 = IF(E52 == -12, 0, E52) — sentinel masks "not applicable".
  return e52 === -12 ? 0 : e52;
}

function lookupOriginalTrusses(
  config: BuildingConfig,
  ctx: ResolvedInputs,
  snow: SnowMatrices
): number {
  const code = ctx.stateConst?.code;
  if (!code) return 0;
  const t = snow.trusses;
  if (!t?.colKeys?.length || !t.lengths?.length) return 0;
  const colKey = `${ctx.trussWidth}-${code}`;
  const colIdx = matchString(colKey, t.colKeys);
  if (colIdx === 0) return 0;
  // Length axis = 1..100; for length L we want row L (1-indexed).
  const lengthIdx = Math.min(Math.max(Math.round(config.length), 1), t.lengths.length);
  return t.counts[lengthIdx - 1]?.[colIdx - 1] ?? 0;
}

function lookupHatChannelSpacing(
  config: BuildingConfig,
  ctx: ResolvedInputs,
  snow: SnowMatrices
): number {
  const hc = snow.hatChannels;
  if (!hc?.rowKeys?.length || !hc.windHeader?.length) return 0;
  const rowKey = `${ctx.hcWidth}-${ctx.snowCode}`;
  const rowIdx = matchString(rowKey, hc.rowKeys);
  const colIdx = hc.windHeader.indexOf(config.windMph) + 1;
  if (rowIdx === 0 || colIdx === 0) return 0;
  return hc.spacingTable[rowIdx - 1]?.[colIdx - 1] ?? 0;
}

function lookupOriginalHatChannels(ctx: ResolvedInputs, snow: SnowMatrices): number {
  const code = ctx.stateConst?.code;
  if (!code) return 0;
  const hc = snow.hatChannels;
  if (!hc?.stateCodes?.length || !hc.widthHeader?.length) return 0;
  const rowIdx = hc.stateCodes.indexOf(code) + 1;
  const colIdx = hc.widthHeader.indexOf(ctx.trussWidth) + 1;
  if (rowIdx === 0 || colIdx === 0) return 0;
  return hc.originalCounts[rowIdx - 1]?.[colIdx - 1] ?? 0;
}

function lookupGirtSpacing(
  trussSpacing: number,
  config: BuildingConfig,
  snow: SnowMatrices
): number {
  const g = snow.girts;
  if (!g?.girtRowKeys?.length || trussSpacing <= 0) return 0;

  // Bucket the truss spacing via row 27/28 (G31 → G32 in the workbook).
  const bucketIdx = g.trussSpacingAxis.indexOf(trussSpacing);
  const bucket = bucketIdx >= 0 ? g.trussSpacingBucket[bucketIdx] : trussSpacing;

  const rowIdx = g.girtRowKeys.indexOf(bucket) + 1;
  const colIdx = g.windHeader.indexOf(config.windMph) + 1;
  if (rowIdx === 0 || colIdx === 0) return 0;
  return g.spacingTable[rowIdx - 1]?.[colIdx - 1] ?? 0;
}

function lookupOriginalGirts(legHeight: number, snow: SnowMatrices): number {
  const g = snow.girts;
  if (!g?.legHeightCol?.length) return 0;
  const idx = g.legHeightCol.indexOf(legHeight);
  if (idx === -1) return 0;
  return g.originalCol[idx] ?? 0;
}

function lookupVerticalSpacing(config: BuildingConfig, snow: SnowMatrices): number {
  const v = snow.verticals;
  if (!v?.legHeightHeader?.length || !v.windCol?.length) return 0;
  const colIdx = v.legHeightHeader.indexOf(config.height) + 1;
  const rowIdx = v.windCol.indexOf(config.windMph) + 1;
  if (rowIdx === 0 || colIdx === 0) return 0;
  return v.spacingTable[rowIdx - 1]?.[colIdx - 1] ?? 0;
}

function lookupOriginalVerticals(ctx: ResolvedInputs, snow: SnowMatrices): number {
  const v = snow.verticals;
  if (!v?.widthHeader?.length) return 0;
  const idx = v.widthHeader.indexOf(ctx.trussWidth);
  if (idx === -1) return 0;
  return v.originalRow[idx] ?? 0;
}
